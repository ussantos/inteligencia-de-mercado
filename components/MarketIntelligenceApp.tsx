'use client';

// Tela principal da aplicacao.
// Ela foi desenhada para funcionar sem login: o visitante informa o tipo de negocio,
// escolhe uma localizacao e recebe uma analise regional simples.
import { AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet, Loader2, MapPin, Radar, ShieldCheck, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useMemo, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Badge, Button, Card, Input } from '@/components/ui';
import { normalizeCep, isValidCep, detectCepColumn } from '@/lib/cep';
import { formatCep, formatCnpj } from '@/lib/utils';
import { COMPETITOR_TYPES, DEFAULT_COMPETITOR_TYPES, type CompetitorType } from '@/lib/competitor-types';
import type { AnalysisResult, UnidadeNegocio } from '@/lib/types';

interface ParsedCeps {
  ceps: string[];
  errors: string[];
  sensitiveWarning: boolean;
}

interface UploadedBlob {
  blobName: string;
}

const COURSE_REFERENCES = [
  {
    title: 'Inteligência Artificial',
    href: 'https://www.myrobotbarra.com.br/inteligencia-artificial.html',
    logo: 'https://www.myrobotbarra.com.br/assets/images/course-logos/inteligencia-artificial.webp'
  },
  {
    title: 'App Developer',
    href: 'https://www.myrobotbarra.com.br/app-developer.html',
    logo: 'https://www.myrobotbarra.com.br/assets/images/course-logos/appdeveloper.webp'
  }
];

function visitorId() {
  // O site nao pede login. Este identificador anonimo ajuda o servidor a aplicar rate limit basico.
  if (typeof window === 'undefined') return 'server';
  const key = 'market-intelligence-visitor-id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, id);
  return id;
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', 'x-visitor-id': visitorId() };
}

function requestHeaders() {
  return { 'x-visitor-id': visitorId() };
}

function parseRows(rows: Record<string, unknown>[]): ParsedCeps {
  // A planilha pode ter muitas colunas, mas a analise usa apenas a coluna de CEP.
  if (!rows.length) return { ceps: [], errors: ['Nenhum dado encontrado no arquivo.'], sensitiveWarning: false };
  const headers = Object.keys(rows[0]);
  const cepIndex = detectCepColumn(headers);
  if (cepIndex < 0) return { ceps: [], errors: ['Nenhuma coluna de CEP encontrada no arquivo.'], sensitiveWarning: false };
  const cepHeader = headers[cepIndex];
  const sensitiveWarning = headers.some((header) => /nome|telefone|celular|email|e-mail|cpf/i.test(header));
  const ceps: string[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const value = String(row[cepHeader] ?? '').trim();
    if (!value) return;
    const cep = normalizeCep(value);
    if (isValidCep(cep)) ceps.push(cep);
    else errors.push(`CEP invalido na linha ${idx + 2}: ${value}`);
  });

  return { ceps, errors, sensitiveWarning };
}

async function parseFile(file: File): Promise<ParsedCeps> {
  // CSV e XLSX sao lidos no navegador. Assim dados pessoais nao precisam sair da maquina.
  if (file.size > 50 * 1024 * 1024) {
    return { ceps: [], errors: ['Arquivo maior que o limite permitido de 50MB'], sensitiveWarning: false };
  }

  if (file.name.toLowerCase().endsWith('.csv')) {
    return new Promise((resolve) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(parseRows(result.data)),
        error: () => resolve({ ceps: [], errors: ['Erro ao processar o arquivo. Verifique o formato e tente novamente.'], sensitiveWarning: false })
      });
    });
  }

  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    return parseRows(rows);
  }

  return { ceps: [], errors: ['Formato de arquivo nao suportado. Use .csv ou .xlsx'], sensitiveWarning: false };
}

function clampAnalysisRadius(value: number) {
  if (!Number.isFinite(value)) return 4;
  return Math.min(20, Math.max(1, Math.round(value)));
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inferCompetitorOptions(activityDescription: string): Array<{ type: CompetitorType; reason: string; suggested: boolean }> {
  // A ordem das opcoes muda de acordo com o ramo informado, mas "Todos" continua sendo o padrao.
  const text = normalizeText(activityDescription);
  const suggested = new Set<CompetitorType>(['Todos', 'Concorrentes diretos do ramo informado', 'Concorrentes locais similares', 'Concorrentes bem avaliados no Google']);

  if (/educa|ensino|trein|curso|idioma|informatica|escola|aula/.test(text)) {
    ['Polos geradores de público', 'Negócios complementares para parceria', 'Substitutos e alternativas de compra'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/farm|saude|clinica|medic|odont|terap|estet/.test(text)) {
    ['Redes e franquias do setor', 'Prestadores autônomos e pequenos negócios', 'Barreiras de acesso e conveniência'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/padaria|restaurante|bar|lanche|mercado|comida|delivery|aliment/.test(text)) {
    ['Redes e franquias do setor', 'Marketplaces, delivery e canais digitais', 'Polos geradores de público'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/servic|consult|manutenc|tecnic|profissional/.test(text)) {
    ['Prestadores autônomos e pequenos negócios', 'Substitutos e alternativas de compra', 'Negócios complementares para parceria'].forEach((type) => suggested.add(type as CompetitorType));
  } else {
    ['Polos geradores de público', 'Negócios complementares para parceria'].forEach((type) => suggested.add(type as CompetitorType));
  }

  const reasons: Record<CompetitorType, string> = {
    Todos: 'Recomendado para uma primeira leitura ampla da regiao.',
    'Concorrentes diretos do ramo informado': 'Busca empresas com oferta parecida com o ramo descrito.',
    'Concorrentes locais similares': 'Encontra negocios parecidos mesmo quando usam outra descricao publica.',
    'Redes e franquias do setor': 'Mostra marcas estruturadas que competem por preco, confianca ou presenca.',
    'Substitutos e alternativas de compra': 'Mapeia opcoes que resolvem o mesmo problema de outro jeito.',
    'Prestadores autônomos e pequenos negócios': 'Considera profissionais independentes e ofertas menores.',
    'Marketplaces, delivery e canais digitais': 'Inclui canais digitais, aplicativos e venda online quando fizer sentido.',
    'Polos geradores de público': 'Mostra locais que concentram fluxo e podem influenciar demanda.',
    'Negócios complementares para parceria': 'Encontra negocios que podem indicar clientes ou fazer acoes conjuntas.',
    'Barreiras de acesso e conveniência': 'Observa fatores de acesso, conveniencia e deslocamento.',
    'Concorrentes bem avaliados no Google': 'Prioriza negocios com reputacao publica forte.'
  };

  return [...COMPETITOR_TYPES]
    .map((type) => ({ type, reason: reasons[type], suggested: suggested.has(type) }))
    .sort((a, b) => Number(!a.suggested) - Number(!b.suggested) || COMPETITOR_TYPES.indexOf(a.type) - COMPETITOR_TYPES.indexOf(b.type));
}

function makeManualUnit(input: {
  businessName: string;
  businessActivityDescription: string;
  manualCep: string;
  manualAddress: string;
  manualNumber: string;
  manualNeighborhood: string;
  manualCity: string;
  manualUf: string;
}): UnidadeNegocio {
  // Unidade manual representa um estudo de negocio novo, sem CNPJ aberto.
  const activity = input.businessActivityDescription.trim();
  const name = input.businessName.trim() || `Estudo de mercado: ${activity}`;
  return {
    cnpj: '',
    razaoSocial: name,
    nomeFantasia: input.businessName.trim() || null,
    situacaoCadastral: 'Estudo sem CNPJ',
    cnaePrincipalCodigo: '',
    cnaePrincipalDescricao: 'Ramo informado manualmente',
    cnaeSecundarios: [],
    cnaes: [],
    logradouro: input.manualAddress.trim(),
    numero: input.manualNumber.trim() || 's/n',
    complemento: null,
    bairro: input.manualNeighborhood.trim(),
    municipio: input.manualCity.trim(),
    uf: input.manualUf.trim().toUpperCase(),
    cep: normalizeCep(input.manualCep),
    telefone: null,
    email: null,
    porte: null,
    naturezaJuridica: null,
    capitalSocial: null,
    dataAbertura: null
  };
}

export function MarketIntelligenceApp() {
  const [cnpj, setCnpj] = useState('');
  const [unidade, setUnidade] = useState<UnidadeNegocio | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessActivityDescription, setBusinessActivityDescription] = useState('');
  const [manualCep, setManualCep] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [manualNeighborhood, setManualNeighborhood] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualUf, setManualUf] = useState('RJ');
  const [competitorTypes, setCompetitorTypes] = useState<CompetitorType[]>(DEFAULT_COMPETITOR_TYPES);
  const [analysisRadiusKm, setAnalysisRadiusKm] = useState(4);
  const [ceps, setCeps] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sensitiveWarning, setSensitiveWarning] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [blobWarning, setBlobWarning] = useState<string | null>(null);
  const [uploadedBlob, setUploadedBlob] = useState<UploadedBlob | null>(null);

  const competitorOptions = useMemo(() => inferCompetitorOptions(businessActivityDescription), [businessActivityDescription]);
  const safeAnalysisRadiusKm = clampAnalysisRadius(analysisRadiusKm);
  const uniqueCeps = useMemo(() => [...new Set(ceps)], [ceps]);
  const hasExistingBusiness = Boolean(unidade?.cnpj);
  const resultStep = hasExistingBusiness ? 5 : 4;
  const hasMarketScope = businessActivityDescription.trim().length >= 3;
  const hasManualAddress = manualAddress.trim().length >= 5 && manualCity.trim().length >= 2 && manualUf.trim().length >= 2;
  const hasManualCep = normalizeCep(manualCep).length === 8;
  const hasLocation = hasExistingBusiness || hasManualCep || hasManualAddress;
  const canAnalyze = hasMarketScope && hasLocation && competitorTypes.length > 0 && !loadingAnalysis;

  async function deleteTemporaryBlob(blob: UploadedBlob | null) {
    if (!blob) return false;
    try {
      const response = await fetch('/api/blob/delete', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ blobName: blob.blobName })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function handleCnpjLookup() {
    setLoadingCnpj(true);
    setGlobalError(null);
    try {
      const response = await fetch('/api/cnpj', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ cnpj })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao consultar CNPJ.');
      const found = json.unidade as UnidadeNegocio;
      setUnidade(found);
      setBusinessName(found.nomeFantasia || found.razaoSocial || businessName);
      if (!businessActivityDescription.trim() && found.cnaePrincipalDescricao) {
        setBusinessActivityDescription(found.cnaePrincipalDescricao);
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao consultar CNPJ.');
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function clearExistingBusiness() {
    setUnidade(null);
    setCnpj('');
    setCeps([]);
    setErrors([]);
    setSensitiveWarning(false);
    if (uploadedBlob) await deleteTemporaryBlob(uploadedBlob);
    setUploadedBlob(null);
    setBlobWarning(null);
  }

  function toggleCompetitorType(type: CompetitorType) {
    setCompetitorTypes((current) => {
      if (type === 'Todos') return ['Todos'];
      const withoutAll = current.filter((item) => item !== 'Todos');
      if (withoutAll.includes(type)) {
        const next = withoutAll.filter((item) => item !== type);
        return next.length ? next : ['Todos'];
      }
      return [...withoutAll, type];
    });
  }

  async function handleFile(file: File | null) {
    if (!file || !hasExistingBusiness) return;
    if (uploadedBlob) {
      await deleteTemporaryBlob(uploadedBlob);
      setUploadedBlob(null);
    }
    setErrors([]);
    setBlobWarning(null);
    const parsed = await parseFile(file);
    setCeps(parsed.ceps);
    setErrors(parsed.errors);
    setSensitiveWarning(parsed.sensitiveWarning);
    if (parsed.ceps.length) {
      setBlobWarning(`${parsed.ceps.length} CEP(s) lido(s). A analise usara apenas esses CEPs, sem nomes, telefones ou e-mails.`);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const upload = await fetch('/api/blob/upload', { method: 'POST', headers: requestHeaders(), body: formData });
      const data = await upload.json() as { error?: string; blobName?: string };
      if (!upload.ok || !data.blobName) throw new Error(data.error || 'Nao foi possivel enviar o arquivo temporario.');
      setUploadedBlob({ blobName: data.blobName });
      if (parsed.ceps.length) setBlobWarning(`${parsed.ceps.length} CEP(s) lido(s). O arquivo temporario sera apagado depois da analise.`);
    } catch {
      if (parsed.ceps.length) {
        setBlobWarning('CEPs lidos com sucesso. O upload temporario ao Azure Blob nao foi concluido, mas a analise pode continuar porque os CEPs ja foram processados no navegador.');
      } else {
        setBlobWarning('O upload temporario nao foi concluido. Verifique se o arquivo tem uma coluna chamada CEP e tente novamente.');
      }
    }
  }

  async function startAnalysis() {
    const radiusKm = clampAnalysisRadius(analysisRadiusKm);
    const unitForAnalysis = unidade || makeManualUnit({
      businessName,
      businessActivityDescription,
      manualCep,
      manualAddress,
      manualNumber,
      manualNeighborhood,
      manualCity,
      manualUf
    });

    setAnalysisRadiusKm(radiusKm);
    setLoadingAnalysis(true);
    setGlobalError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          unidade: unitForAnalysis,
          ceps: hasExistingBusiness ? uniqueCeps : [],
          businessActivityDescription,
          competitorTypes,
          analysisRadiusKm: radiusKm
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao processar analise.');
      setResult(json.result);
      if (uploadedBlob) {
        const deleted = await deleteTemporaryBlob(uploadedBlob);
        setUploadedBlob(null);
        setBlobWarning(deleted
          ? 'Analise concluida e arquivo temporario apagado do Azure Blob Storage.'
          : 'Analise concluida. Nao foi possivel confirmar a exclusao do arquivo temporario; verifique as permissoes do Azure Blob Storage.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao processar analise.');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <div className="no-print mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Nova analise
            </button>
          </div>
          <Dashboard result={result} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <CourseReferences />

        <Card className="mb-6 border-orange-200 bg-orange-50">
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 flex-none text-orange-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Aviso LGPD</h2>
              <p className="mt-1 text-sm text-slate-700">
                A ferramenta usa apenas os dados necessarios para gerar a analise. CNPJ e endereco ajudam a localizar a regiao; CEPs de clientes, quando enviados, sao opcionais e processados sem nomes, telefones ou e-mails.
              </p>
            </div>
          </div>
        </Card>

        {globalError && (
          <Card className="mb-6 border-red-200 bg-red-50 text-red-800">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5" />
              <p>{globalError}</p>
            </div>
          </Card>
        )}

        <section className="space-y-6">
          <Card>
            <Badge className="bg-slate-100 text-slate-600">1 — Negocio e regiao</Badge>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Que negocio voce quer analisar?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Voce pode analisar uma empresa existente ou estudar a abertura de um novo negocio. O campo mais importante e o ramo de atividade: farmácia, padaria, restaurante, curso de tecnologia, clinica, loja de roupas etc.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800" htmlFor="business-name">Nome do negocio <span className="text-slate-400">(opcional)</span></label>
                <Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ex: Padaria do Bairro" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800" htmlFor="manual-cep">CEP ou endereco de referencia</label>
                <Input id="manual-cep" value={manualCep} onChange={(event) => setManualCep(event.target.value)} placeholder="Ex: 22775-003" />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800" htmlFor="business-activity-description">Ramo de atividade <span className="text-orange-600">(obrigatorio)</span></label>
              <textarea
                id="business-activity-description"
                value={businessActivityDescription}
                onChange={(event) => setBusinessActivityDescription(event.target.value.slice(0, 300))}
                placeholder="Ex: restaurante italiano de bairro com foco em almoço executivo e delivery"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Quanto mais especifico, mais coerente sera a busca por concorrentes.</span>
                <span>{businessActivityDescription.length}/300</span>
              </div>
            </div>

            {!hasExistingBusiness && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  Localizacao do estudo
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Se voce informou um CEP valido, o endereco completo e opcional. Se preferir, preencha cidade, UF e endereco de referencia.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
                  <Input value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} placeholder="Rua, avenida ou ponto de referencia" />
                  <Input value={manualNumber} onChange={(event) => setManualNumber(event.target.value)} placeholder="Numero" />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.5fr_1.5fr_0.7fr]">
                  <Input value={manualNeighborhood} onChange={(event) => setManualNeighborhood(event.target.value)} placeholder="Bairro" />
                  <Input value={manualCity} onChange={(event) => setManualCity(event.target.value)} placeholder="Cidade" />
                  <Input value={manualUf} onChange={(event) => setManualUf(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" />
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-slate-800">Ja tem CNPJ? Use como atalho opcional.</p>
              <p className="mt-1 text-sm text-slate-500">O CNPJ preenche dados da empresa e libera o upload opcional de CEPs de clientes.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="CNPJ — ex: 12.345.678/0001-90" />
                <Button className="whitespace-normal text-center md:whitespace-nowrap" onClick={handleCnpjLookup} disabled={loadingCnpj || cnpj.replace(/\D/g, '').length < 14}>
                  {loadingCnpj ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
                  Consultar CNPJ
                </Button>
              </div>

              {unidade && (
                <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                      Empresa encontrada
                    </div>
                    <button type="button" onClick={clearExistingBusiness} className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50">
                      <Trash2 className="mr-1 h-3 w-3" />
                      Remover CNPJ
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><strong>Razao Social:</strong> {unidade.razaoSocial}</p>
                    <p><strong>Nome Fantasia:</strong> {unidade.nomeFantasia || 'Nao informado'}</p>
                    <p><strong>CNPJ:</strong> {formatCnpj(unidade.cnpj)}</p>
                    <p><strong>Situacao:</strong> {unidade.situacaoCadastral}</p>
                    <p><strong>CEP:</strong> {formatCep(unidade.cep)}</p>
                    <p className="md:col-span-2"><strong>Endereco:</strong> {unidade.logradouro}, {unidade.numero} — {unidade.bairro}, {unidade.municipio}/{unidade.uf}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <Badge className="bg-slate-100 text-slate-600">2 — Concorrencia</Badge>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Quais concorrentes devem entrar na leitura?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Para vender melhor, a primeira analise pode ficar em <strong>Todos</strong>. Se voce quiser uma leitura mais focada, escolha categorias especificas.
            </p>
            {businessActivityDescription.trim() && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                A busca vai priorizar concorrentes relacionados a: <strong>{businessActivityDescription.trim()}</strong>.
              </div>
            )}
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {competitorOptions.map((option) => (
                <label key={option.type} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm hover:bg-slate-50 ${option.suggested ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={competitorTypes.includes(option.type)} onChange={() => toggleCompetitorType(option.type)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="font-semibold text-slate-900">{option.type}</span>
                    {option.suggested && <Badge className="ml-2 bg-orange-100 text-orange-700">Sugerido</Badge>}
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <Badge className="bg-slate-100 text-slate-600">3 — Raio de analise</Badge>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Escolha ate onde olhar ao redor</h2>
            <p className="mt-2 text-sm text-slate-500">Comece com 4 km para negocios locais. Aumente se o cliente costuma se deslocar ou se o servico tem alcance regional.</p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-700">Raio em torno da localizacao</span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">{safeAnalysisRadiusKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={safeAnalysisRadiusKm}
                onChange={(event) => setAnalysisRadiusKm(clampAnalysisRadius(Number(event.target.value)))}
                className="mt-4 w-full accent-orange-500"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>1 km</span>
                <span>4 km sugerido</span>
                <span>20 km</span>
              </div>
            </div>
          </Card>

          {hasExistingBusiness && (
            <Card>
              <Badge className="bg-slate-100 text-slate-600">4 — Clientes atuais</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">CEPs de clientes <span className="text-slate-400">(opcional)</span></h2>
              <>
                <p className="mt-2 text-sm text-slate-500">
                  Como voce informou um CNPJ, pode enviar CEPs de clientes atuais para entender onde sua base real aparece. Se nao tiver planilha, pule esta etapa.
                </p>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p><strong>Formato aceito:</strong> uma coluna chamada <code className="rounded bg-white px-1 py-0.5">cep</code>. Pode usar <code className="rounded bg-white px-1 py-0.5">22775003</code>, <code className="rounded bg-white px-1 py-0.5">22775-003</code> ou <code className="rounded bg-white px-1 py-0.5">22.775-003</code>.</p>
                  <a href="/modelo-ceps-clientes.csv" download className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar modelo CSV de CEPs
                  </a>
                </div>
                <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-orange-400 hover:bg-orange-50">
                  <FileSpreadsheet className="h-10 w-10 text-orange-500" />
                  <span className="mt-3 font-semibold text-slate-800">Selecionar arquivo CSV/XLSX de CEPs</span>
                  <span className="mt-1 text-sm text-slate-500">Apenas a coluna CEP sera processada. Limite de 50MB.</span>
                  <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => handleFile(event.target.files?.[0] || null)} />
                </label>
                {sensitiveWarning && <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-800">Foram identificadas colunas desnecessarias. Apenas os CEPs serao processados.</p>}
                {blobWarning && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{blobWarning}</p>}
                {errors.length > 0 && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div>}
                {uniqueCeps.length > 0 && (
                  <div className="mt-5">
                    <h3 className="font-semibold text-slate-900">Pre-visualizacao dos CEPs</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {uniqueCeps.slice(0, 40).map((cep) => <Badge key={cep} className="bg-slate-100 text-slate-700">{formatCep(cep)}</Badge>)}
                      {uniqueCeps.length > 40 && <Badge className="bg-slate-100 text-slate-700">+{uniqueCeps.length - 40}</Badge>}
                    </div>
                  </div>
                )}
              </>
            </Card>
          )}

          <Card className="border-orange-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-orange-100 text-orange-700">{resultStep} — Resultado</Badge>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Gerar analise simplificada</h2>
                <p className="mt-2 text-sm text-slate-500">
                  A ferramenta vai analisar {businessActivityDescription.trim() || 'o ramo informado'} em um raio de {safeAnalysisRadiusKm} km, usando {hasExistingBusiness ? 'o endereco do CNPJ' : 'a localizacao informada'}.
                </p>
              </div>
              <Button className="min-w-52" onClick={startAnalysis} disabled={!canAnalyze}>
                {loadingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                Analisar regiao
              </Button>
            </div>
            {!canAnalyze && (
              <p className="mt-4 text-sm text-slate-500">
                Para iniciar, informe o ramo de atividade, uma localizacao por CEP ou endereco, e mantenha pelo menos um tipo de concorrente selecionado.
              </p>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur no-print">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Inteligencia de Mercado</p>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Analise regional simplificada</h1>
        </div>
        <a href="https://www.myrobotbarra.com.br/" target="_blank" rel="noreferrer" className="hidden text-sm font-semibold text-slate-600 hover:text-orange-600 md:inline">
          My Robot Barra da Tijuca
        </a>
      </div>
    </header>
  );
}

function CourseReferences() {
  return (
    <Card className="mb-6">
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <Badge className="bg-orange-100 text-orange-700">Projeto educacional aplicado</Badge>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">Ferramenta criada para praticar IA, dados e desenvolvimento de apps</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta aplicacao demonstra, em formato simples, conceitos ensinados nos cursos de Inteligencia Artificial e App Developer da My Robot Barra da Tijuca.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {COURSE_REFERENCES.map((course) => (
            <a key={course.title} href={course.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center transition hover:border-orange-300 hover:bg-orange-50">
              <img src={course.logo} alt={course.title} className="mx-auto h-14 max-w-full object-contain" />
              <span className="mt-3 block text-sm font-bold text-slate-800">{course.title}</span>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}
