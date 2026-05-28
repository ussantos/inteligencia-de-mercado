'use client';

// Este componente e a tela principal que o usuario usa.
// Ele guarda o que a pessoa digitou, consulta CNPJ, le arquivos de CEPs e pede a analise ao servidor.
// "use client" significa que este codigo roda no navegador, porque precisa reagir a cliques e uploads.
import { SignOutButton, UserButton, useUser } from '@clerk/nextjs';
import { AlertTriangle, Building2, CheckCircle2, FileSpreadsheet, Loader2, Radar, ShieldCheck } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useEffect, useMemo, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Badge, Button, Card, Input } from '@/components/ui';
import { normalizeCep, isValidCep, detectCepColumn } from '@/lib/cep';
import { formatCep, formatCnpj } from '@/lib/utils';
import { COMPETITOR_TYPES, DEFAULT_COMPETITOR_TYPES, type CompetitorType } from '@/lib/competitor-types';
import type { AnalysisResult, CnaeOption, UnidadeNegocio } from '@/lib/types';

interface ParsedCeps {
  ceps: string[];
  errors: string[];
  sensitiveWarning: boolean;
}

function parseRows(rows: Record<string, unknown>[]): ParsedCeps {
  // A planilha pode ter muitas colunas, mas a aplicacao so precisa da coluna de CEP.
  // Se existirem colunas sensiveis, como telefone ou CPF, avisamos o usuario e ignoramos esses dados.
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
    else errors.push(`CEP inválido na linha ${idx + 2}: ${value}`);
  });

  return { ceps, errors, sensitiveWarning };
}

async function parseFile(file: File): Promise<ParsedCeps> {
  // O navegador le CSV e XLSX de formas diferentes.
  // Aqui decidimos qual leitor usar olhando o final do nome do arquivo.
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

  return { ceps: [], errors: ['Formato de arquivo não suportado. Use .csv ou .xlsx'], sensitiveWarning: false };
}

function cnaeKey(cnae: CnaeOption) {
  return `${cnae.codigo}:${cnae.descricao}:${cnae.tipo}`;
}

export function MarketIntelligenceApp() {
  // Estes estados sao como caixinhas de memoria da tela.
  // Cada caixinha guarda uma parte do formulario ou do resultado para o React redesenhar a tela quando algo muda.
  const { user } = useUser();
  const [cnpj, setCnpj] = useState('');
  const [unidade, setUnidade] = useState<UnidadeNegocio | null>(null);
  const [selectedCnaes, setSelectedCnaes] = useState<CnaeOption[]>([]);
  const [competitorTypes, setCompetitorTypes] = useState<CompetitorType[]>(DEFAULT_COMPETITOR_TYPES);
  const [analysisRadiusKm, setAnalysisRadiusKm] = useState(8);
  const [ceps, setCeps] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sensitiveWarning, setSensitiveWarning] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [blobWarning, setBlobWarning] = useState<string | null>(null);

  const allCnaes = useMemo(() => unidade?.cnaes?.length ? unidade.cnaes : unidade ? [{ codigo: unidade.cnaePrincipalCodigo, descricao: unidade.cnaePrincipalDescricao, tipo: 'Principal' as const }] : [], [unidade]);
  const canAnalyze = Boolean(unidade && selectedCnaes.length > 0 && competitorTypes.length > 0 && !loadingAnalysis);
  const uniqueCeps = useMemo(() => [...new Set(ceps)], [ceps]);

  useEffect(() => {
    // Quando o CNPJ e encontrado, selecionamos automaticamente o CNAE principal.
    // Isso ajuda o usuario a comecar sem precisar marcar tudo manualmente.
    if (unidade) {
      const cnaes = unidade.cnaes?.length ? unidade.cnaes : [{ codigo: unidade.cnaePrincipalCodigo, descricao: unidade.cnaePrincipalDescricao, tipo: 'Principal' as const }];
      setSelectedCnaes(cnaes.filter((cnae) => cnae.tipo === 'Principal').slice(0, 1));
    }
  }, [unidade]);

  async function handleCnpjLookup() {
    // Esta funcao chama nossa API de CNPJ.
    // Se der certo, guardamos os dados do negocio; se der erro, mostramos uma mensagem amigavel.
    setLoadingCnpj(true);
    setGlobalError(null);
    setUnidade(null);
    try {
      const response = await fetch('/api/cnpj', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao consultar CNPJ.');
      setUnidade(json.unidade);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao consultar CNPJ.');
    } finally {
      setLoadingCnpj(false);
    }
  }

  function toggleCnae(cnae: CnaeOption) {
    setSelectedCnaes((current) => {
      const key = cnaeKey(cnae);
      if (current.some((item) => cnaeKey(item) === key)) return current.filter((item) => cnaeKey(item) !== key);
      return [...current, cnae];
    });
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
    // O arquivo e processado no navegador para extrair somente CEPs.
    // Depois tentamos subir o arquivo para o Azure Blob, mas a analise continua mesmo se esse upload falhar.
    if (!file) return;
    setErrors([]);
    setBlobWarning(null);
    const parsed = await parseFile(file);
    setCeps(parsed.ceps);
    setErrors(parsed.errors);
    setSensitiveWarning(parsed.sensitiveWarning);

    try {
      const sas = await fetch('/api/blob/sas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const data = await sas.json();
      if (!sas.ok) throw new Error(data.error);
      await fetch(data.sasUrl, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    } catch (error) {
      setBlobWarning(error instanceof Error ? error.message : 'Upload temporário não executado. A análise seguirá usando os CEPs processados localmente.');
    }
  }

  async function startAnalysis() {
    // Aqui juntamos CNPJ, CNAEs, tipos de concorrentes, raio e CEPs.
    // O servidor recebe esse pacote e devolve o relatorio completo.
    if (!unidade) return;
    setLoadingAnalysis(true);
    setGlobalError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade, ceps: uniqueCeps, selectedCnaes, competitorTypes, analysisRadiusKm })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao processar análise.');
      setResult(json.result);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao processar análise.');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Inteligência de Mercado</p>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Análise regional de concorrência</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 md:inline">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
            <UserButton />
            <SignOutButton><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sair</button></SignOutButton>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 flex-none text-orange-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Aviso LGPD</h2>
              <p className="mt-1 text-sm text-slate-700">Os dados do arquivo enviado são processados temporariamente apenas para fins de análise. Apenas CEPs são usados; nomes, telefones, e-mails e outros dados pessoais são ignorados.</p>
            </div>
          </div>
        </Card>

        {globalError && <Card className="mb-6 border-red-200 bg-red-50 text-red-800"><div className="flex gap-3"><AlertTriangle className="h-5 w-5" /><p>{globalError}</p></div></Card>}

        {!result ? (
          <section className="space-y-6">
            <Card>
              <Badge className="bg-slate-100 text-slate-600">1 — Dados do negócio</Badge>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">Informe o CNPJ do negócio</h2>
              <p className="mt-2 text-sm text-slate-500">O sistema consulta bases públicas, identifica endereço, CEP e CNAEs, e usa esses dados para orientar a busca de concorrentes na região.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="CNPJ — ex: 12.345.678/0001-90" />
                <Button onClick={handleCnpjLookup} disabled={loadingCnpj || cnpj.replace(/\D/g, '').length < 14}>{loadingCnpj ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />} Consultar CNPJ</Button>
              </div>

              {unidade && (
                <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-800">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Empresa encontrada</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><strong>Razão Social:</strong> {unidade.razaoSocial}</p>
                    <p><strong>Nome Fantasia:</strong> {unidade.nomeFantasia || 'Não informado'}</p>
                    <p><strong>CNPJ:</strong> {formatCnpj(unidade.cnpj)}</p>
                    <p><strong>Situação:</strong> {unidade.situacaoCadastral}</p>
                    <p><strong>CNAE Principal:</strong> {unidade.cnaePrincipalCodigo} — {unidade.cnaePrincipalDescricao}</p>
                    <p><strong>CEP detectado via CNPJ:</strong> {formatCep(unidade.cep)}</p>
                    <p className="md:col-span-2"><strong>Endereço:</strong> {unidade.logradouro}, {unidade.numero} — {unidade.bairro}, {unidade.municipio}/{unidade.uf}</p>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <Badge className="bg-slate-100 text-slate-600">2 — CNAEs analisados</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Escolha os CNAEs que melhor representam a análise</h2>
              <p className="mt-2 text-sm text-slate-500">A lista é gerada automaticamente a partir do CNPJ. Os CNAEs selecionados ajudam a montar buscas no Google Places e a contextualizar a análise.</p>
              {!unidade ? <p className="mt-4 text-sm text-slate-500">Consulte o CNPJ para carregar os CNAEs.</p> : <div className="mt-4 grid gap-3">{allCnaes.map((cnae) => <label key={cnaeKey(cnae)} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={selectedCnaes.some((item) => cnaeKey(item) === cnaeKey(cnae))} onChange={() => toggleCnae(cnae)} className="mt-1 h-4 w-4" /><span><strong>{cnae.tipo}</strong> · {cnae.codigo ? `${cnae.codigo} — ` : ''}{cnae.descricao}</span></label>)}</div>}
            </Card>

            <Card>
              <Badge className="bg-slate-100 text-slate-600">3 — Tipos de concorrentes</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Selecione um ou mais tipos de concorrentes</h2>
              <p className="mt-2 text-sm text-slate-500">“Todos” é o padrão e combina buscas pelo segmento, CNAE e categorias regionais. Para análises mais objetivas, selecione categorias específicas.</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {COMPETITOR_TYPES.map((type) => <label key={type} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><input type="checkbox" checked={competitorTypes.includes(type)} onChange={() => toggleCompetitorType(type)} className="mt-1 h-4 w-4" /><span>{type}</span></label>)}
              </div>
            </Card>

            <Card>
              <Badge className="bg-slate-100 text-slate-600">4 — Região e clientes atuais</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Defina o raio de análise e, opcionalmente, envie CEPs de clientes</h2>
              <p className="mt-2 text-sm text-slate-500">O upload de CEPs é opcional e serve para demonstrar onde estão os clientes atuais do negócio. Mesmo sem planilha, a ferramenta analisa a região de atuação do empreendimento a partir do raio informado.</p>
              <div className="mt-5 max-w-xs">
                <label className="text-sm font-semibold text-slate-700">Raio de análise em torno do negócio</label>
                <Input type="number" min={1} max={50} value={analysisRadiusKm} onChange={(event) => setAnalysisRadiusKm(Number(event.target.value || 8))} />
                <p className="mt-1 text-xs text-slate-500">Padrão: 8 km. Limite operacional: 1 a 50 km.</p>
              </div>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-orange-400 hover:bg-orange-50">
                <FileSpreadsheet className="h-10 w-10 text-orange-500" />
                <span className="mt-3 font-semibold text-slate-800">Selecionar arquivo CSV/XLSX de CEPs, opcional</span>
                <span className="mt-1 text-sm text-slate-500">Limite de 50MB. Apenas a coluna CEP será processada.</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => handleFile(event.target.files?.[0] || null)} />
              </label>
              {sensitiveWarning && <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-800">Foram identificadas colunas que não são necessárias para esta análise. Apenas os CEPs serão processados.</p>}
              {blobWarning && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{blobWarning}</p>}
              {errors.length > 0 && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div>}
              {uniqueCeps.length > 0 && <div className="mt-5"><h3 className="font-semibold text-slate-900">Pré-visualização dos CEPs</h3><div className="mt-3 flex flex-wrap gap-2">{uniqueCeps.slice(0, 40).map((cep) => <Badge key={cep} className="bg-slate-100 text-slate-700">{formatCep(cep)}</Badge>)}{uniqueCeps.length > 40 && <Badge className="bg-slate-100 text-slate-700">+{uniqueCeps.length - 40}</Badge>}</div></div>}
            </Card>

            <Card className="border-orange-200 bg-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <Badge className="bg-orange-100 text-orange-700">5 — Iniciar</Badge>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900">Iniciar análise da região</h2>
                  <p className="mt-2 text-sm text-slate-500">A análise usará o CNPJ, os CNAEs selecionados, os tipos de concorrentes, o raio de {analysisRadiusKm} km e os CEPs de clientes, se enviados.</p>
                </div>
                <Button className="min-w-56" onClick={startAnalysis} disabled={!canAnalyze}>{loadingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />} Iniciar análise</Button>
              </div>
              {!canAnalyze && <p className="mt-4 text-sm text-slate-500">Para iniciar, consulte um CNPJ válido, selecione pelo menos um CNAE e um tipo de concorrente.</p>}
            </Card>
          </section>
        ) : (
          <Dashboard result={result} />
        )}
      </div>
    </main>
  );
}
