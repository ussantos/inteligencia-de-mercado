'use client';

// Este componente e a tela principal que o usuario usa.
// Ele guarda o que a pessoa digitou, consulta CNPJ, le arquivos de CEPs e pede a analise ao servidor.
// "use client" significa que este codigo roda no navegador, porque precisa reagir a cliques e uploads.
import { UserButton, useAuth, useClerk, useUser } from '@clerk/nextjs';
import { AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet, Loader2, LogOut, Radar, ShieldCheck } from 'lucide-react';
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

function clampAnalysisRadius(value: number) {
  // O servidor aceita no maximo 50 km.
  // Esta funcao impede que a tela envie 830 km, texto vazio ou outro valor fora do limite.
  if (!Number.isFinite(value)) return 8;
  return Math.min(50, Math.max(1, Math.round(value)));
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inferCompetitorOptions(cnaes: CnaeOption[]): Array<{ type: CompetitorType; reason: string; suggested: boolean }> {
  // A lista base continua sendo a mesma, mas a ordem e as dicas mudam conforme os CNAEs carregados.
  // "Todos" permanece como padrao porque e a escolha mais segura para quem quer uma primeira analise ampla.
  const text = normalizeText(cnaes.map((cnae) => `${cnae.codigo} ${cnae.descricao}`).join(' '));
  const suggested = new Set<CompetitorType>(['Todos', 'Concorrentes diretos pelo CNAE', 'Concorrentes locais similares', 'Concorrentes bem avaliados no Google']);

  if (/educa|ensino|trein|curso|idioma|informatica|escola|aula/.test(text)) {
    ['Polos geradores de público', 'Negócios complementares para parceria', 'Marketplaces, delivery e canais digitais', 'Substitutos e alternativas de compra'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/comerc|varej|loja|equipamento|livro|produto/.test(text)) {
    ['Redes e franquias do setor', 'Marketplaces, delivery e canais digitais', 'Polos geradores de público', 'Negócios complementares para parceria'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/saude|clinica|medic|odont|terap|estet/.test(text)) {
    ['Prestadores autônomos e pequenos negócios', 'Barreiras de acesso e conveniência', 'Polos geradores de público'].forEach((type) => suggested.add(type as CompetitorType));
  } else if (/servic|consult|manutenc|tecnic|profissional/.test(text)) {
    ['Prestadores autônomos e pequenos negócios', 'Substitutos e alternativas de compra', 'Negócios complementares para parceria'].forEach((type) => suggested.add(type as CompetitorType));
  } else {
    ['Polos geradores de público', 'Negócios complementares para parceria'].forEach((type) => suggested.add(type as CompetitorType));
  }

  const reasons: Record<CompetitorType, string> = {
    Todos: 'Recomendado para a primeira análise: combina CNAEs, segmento, concorrentes diretos, indiretos e locais relevantes.',
    'Concorrentes diretos pelo CNAE': 'Usa os CNAEs selecionados para buscar empresas com oferta próxima à sua.',
    'Concorrentes locais similares': 'Procura negócios parecidos na mesma região, mesmo quando o CNAE cadastrado é diferente.',
    'Redes e franquias do setor': 'Ajuda a identificar marcas estruturadas que competem por preço, presença ou confiança.',
    'Substitutos e alternativas de compra': 'Mapeia opções que resolvem o mesmo problema do cliente de outro jeito.',
    'Prestadores autônomos e pequenos negócios': 'Encontra alternativas menores, profissionais independentes e ofertas de bairro.',
    'Marketplaces, delivery e canais digitais': 'Considera concorrência online, aplicativos e canais digitais ligados ao segmento.',
    'Polos geradores de público': 'Mostra locais que concentram pessoas e podem influenciar demanda, parcerias ou fluxo.',
    'Negócios complementares para parceria': 'Busca empresas que podem indicar clientes, fazer ações conjuntas ou complementar a oferta.',
    'Barreiras de acesso e conveniência': 'Avalia fatores de acesso, estacionamento, transporte e conveniência regional.',
    'Concorrentes bem avaliados no Google': 'Prioriza negócios com boa reputação pública e muitas avaliações.'
  };

  return [...COMPETITOR_TYPES]
    .map((type) => ({ type, reason: reasons[type], suggested: suggested.has(type) }))
    .sort((a, b) => Number(!a.suggested) - Number(!b.suggested) || COMPETITOR_TYPES.indexOf(a.type) - COMPETITOR_TYPES.indexOf(b.type));
}

export function MarketIntelligenceApp() {
  // Estes estados sao como caixinhas de memoria da tela.
  // Cada caixinha guarda uma parte do formulario ou do resultado para o React redesenhar a tela quando algo muda.
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
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
  const [signingOut, setSigningOut] = useState(false);

  const allCnaes = useMemo(() => unidade?.cnaes?.length ? unidade.cnaes : unidade ? [{ codigo: unidade.cnaePrincipalCodigo, descricao: unidade.cnaePrincipalDescricao, tipo: 'Principal' as const }] : [], [unidade]);
  const competitorOptions = useMemo(() => inferCompetitorOptions(selectedCnaes.length ? selectedCnaes : allCnaes), [allCnaes, selectedCnaes]);
  const safeAnalysisRadiusKm = clampAnalysisRadius(analysisRadiusKm);
  const canAnalyze = Boolean(unidade && selectedCnaes.length > 0 && competitorTypes.length > 0 && !loadingAnalysis);
  const uniqueCeps = useMemo(() => [...new Set(ceps)], [ceps]);

  useEffect(() => {
    // Se o navegador ficou com uma sessao antiga ou incompleta, mandamos a pessoa para o login.
    // Isso evita a tela parecer logada enquanto as APIs do servidor respondem "Nao autenticado".
    if (isLoaded && !isSignedIn) {
      window.location.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    // Quando o CNPJ e encontrado, selecionamos automaticamente o CNAE principal.
    // Isso ajuda o usuario a comecar sem precisar marcar tudo manualmente.
    if (unidade) {
      const cnaes = unidade.cnaes?.length ? unidade.cnaes : [{ codigo: unidade.cnaePrincipalCodigo, descricao: unidade.cnaePrincipalDescricao, tipo: 'Principal' as const }];
      setSelectedCnaes(cnaes.filter((cnae) => cnae.tipo === 'Principal').slice(0, 1));
    }
  }, [unidade]);

  async function jsonAuthHeaders() {
    // O Azure/Next pode nao repassar cookies do Clerk do jeito esperado em todos os cenarios.
    // Por isso enviamos tambem o token Bearer, deixando as APIs reconhecerem a sessao de forma explicita.
    const token = await getToken();
    if (!token) {
      throw new Error('Sua sessão expirou. Clique em Sair e entre novamente.');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  }

  async function handleUnauthorized(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    if (/não autenticado|nao autenticado|sessão expirou|sessao expirou/i.test(message)) {
      setGlobalError('Sua sessão expirou ou ficou inconsistente. Entre novamente para continuar.');
      return;
    }
    setGlobalError(message);
  }

  async function handleSignOut() {
    // Logout explicito do Clerk. O redirecionamento evita ficar parado em uma pagina protegida com sessao antiga.
    setSigningOut(true);
    setGlobalError(null);
    try {
      await signOut({ redirectUrl: '/sign-in' });
    } catch {
      window.location.assign('/sign-in');
    }
  }

  async function handleCnpjLookup() {
    // Esta funcao chama nossa API de CNPJ.
    // Se der certo, guardamos os dados da empresa; se der erro, mostramos uma mensagem amigavel.
    setLoadingCnpj(true);
    setGlobalError(null);
    setUnidade(null);
    try {
      const response = await fetch('/api/cnpj', { method: 'POST', credentials: 'include', headers: await jsonAuthHeaders(), body: JSON.stringify({ cnpj }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao consultar CNPJ.');
      setUnidade(json.unidade);
    } catch (error) {
      await handleUnauthorized(error, 'Erro ao consultar CNPJ.');
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
    if (parsed.ceps.length) {
      setBlobWarning(`${parsed.ceps.length} CEP(s) lido(s) no navegador. O upload da planilha é opcional; se o armazenamento temporário falhar, a análise continua usando estes CEPs.`);
    }

    try {
      const sas = await fetch('/api/blob/sas', { method: 'POST', credentials: 'include', headers: await jsonAuthHeaders(), body: JSON.stringify({ fileName: file.name }) });
      const data = await sas.json();
      if (!sas.ok) throw new Error(data.error);
      await fetch(data.sasUrl, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (parsed.ceps.length) setBlobWarning(`${parsed.ceps.length} CEP(s) lido(s) e arquivo temporário enviado com sucesso. A análise usará apenas os CEPs extraídos.`);
    } catch (error) {
      if (parsed.ceps.length) {
        setBlobWarning('CEPs lidos com sucesso. O upload temporário ao Azure Blob não foi concluído, mas isso não impede a análise porque os CEPs já foram processados no navegador.');
      } else {
        setBlobWarning('O upload temporário não foi concluído. Verifique se o arquivo tem uma coluna chamada CEP e tente novamente; se a prévia de CEPs aparecer, a análise pode continuar.');
      }
    }
  }

  async function startAnalysis() {
    // Aqui juntamos CNPJ, CNAEs, tipos de concorrentes, raio e CEPs.
    // O servidor recebe esse pacote e devolve o relatorio completo.
    if (!unidade) return;
    const radiusKm = clampAnalysisRadius(analysisRadiusKm);
    setAnalysisRadiusKm(radiusKm);
    setLoadingAnalysis(true);
    setGlobalError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ unidade, ceps: uniqueCeps, selectedCnaes, competitorTypes, analysisRadiusKm: radiusKm })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao processar análise.');
      setResult(json.result);
    } catch (error) {
      await handleUnauthorized(error, 'Erro ao processar análise.');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  if (!isLoaded || (isLoaded && !isSignedIn)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <Card className="max-w-md text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-600" />
          <p className="mt-4 text-sm font-semibold text-slate-700">Verificando sua sessão...</p>
        </Card>
      </main>
    );
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
            <button onClick={handleSignOut} disabled={signingOut} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Sair
            </button>
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
              <Badge className="bg-slate-100 text-slate-600">1 — CNPJ da Empresa</Badge>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">Informe o CNPJ da empresa</h2>
              <p className="mt-2 text-sm text-slate-500">Carregue os dados da empresa antes de continuar. O sistema consulta bases públicas, identifica endereço, CEP e CNAEs, e usa esses dados para orientar a busca de concorrentes na região.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="CNPJ — ex: 12.345.678/0001-90" />
                <Button className="whitespace-normal text-center md:whitespace-nowrap" onClick={handleCnpjLookup} disabled={loadingCnpj || cnpj.replace(/\D/g, '').length < 14}>{loadingCnpj ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />} Carregar dados da minha empresa</Button>
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
              {!unidade ? <p className="mt-4 text-sm text-slate-500">Carregue os dados da empresa pelo CNPJ para continuar e listar os CNAEs.</p> : <div className="mt-4 grid gap-3">{allCnaes.map((cnae) => <label key={cnaeKey(cnae)} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={selectedCnaes.some((item) => cnaeKey(item) === cnaeKey(cnae))} onChange={() => toggleCnae(cnae)} className="mt-1 h-4 w-4" /><span><strong>{cnae.tipo}</strong> · {cnae.codigo ? `${cnae.codigo} — ` : ''}{cnae.descricao}</span></label>)}</div>}
            </Card>

            <Card>
              <Badge className="bg-slate-100 text-slate-600">3 — Tipos de concorrentes</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Tipos de concorrentes sugeridos pelo CNAE</h2>
              <p className="mt-2 text-sm text-slate-500">
                A ferramenta usa os CNAEs selecionados para destacar categorias mais prováveis para este segmento. Mantenha <strong>Todos</strong> marcado para uma primeira análise ampla, ou escolha categorias específicas para reduzir o foco.
              </p>
              {unidade ? (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                  Sugestões baseadas em: {selectedCnaes.length ? selectedCnaes.map((cnae) => cnae.descricao).join(' · ') : unidade.cnaePrincipalDescricao}.
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Carregue o CNPJ para receber sugestões de concorrentes ligadas aos CNAEs da empresa.</p>
              )}
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {competitorOptions.map((option) => <label key={option.type} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm hover:bg-slate-50 ${option.suggested ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200'}`}><input type="checkbox" checked={competitorTypes.includes(option.type)} onChange={() => toggleCompetitorType(option.type)} className="mt-1 h-4 w-4" /><span><span className="font-semibold text-slate-900">{option.type}</span>{option.suggested && <Badge className="ml-2 bg-orange-100 text-orange-700">Sugerido</Badge>}<span className="mt-1 block text-xs leading-5 text-slate-500">{option.reason}</span></span></label>)}
              </div>
            </Card>

            <Card>
              <Badge className="bg-slate-100 text-slate-600">4 — Região e clientes atuais</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Defina o raio de análise e, opcionalmente, envie CEPs de clientes</h2>
              <p className="mt-2 text-sm text-slate-500">
                A planilha de CEPs é opcional. Se você não tiver uma lista de clientes, deixe essa parte em branco: a ferramenta ainda analisa a região em torno da empresa usando o raio informado.
              </p>
              <div className="mt-5 max-w-xs">
                <label className="text-sm font-semibold text-slate-700">Raio de análise em torno da empresa</label>
                <Input type="number" min={1} max={50} value={analysisRadiusKm} onChange={(event) => setAnalysisRadiusKm(clampAnalysisRadius(Number(event.target.value || 8)))} onBlur={() => setAnalysisRadiusKm((current) => clampAnalysisRadius(current))} />
                <p className="mt-1 text-xs text-slate-500">Padrão: 8 km. Limite: 1 a 50 km. Valores maiores são ajustados automaticamente para 50 km.</p>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p><strong>Formato aceito:</strong> uma coluna chamada <code className="rounded bg-white px-1 py-0.5">cep</code>. O CEP pode estar como <code className="rounded bg-white px-1 py-0.5">22775003</code>, <code className="rounded bg-white px-1 py-0.5">22775-003</code> ou <code className="rounded bg-white px-1 py-0.5">22.775-003</code>; a ferramenta usa apenas os 8 números.</p>
                <p className="mt-2">Não envie nomes, telefones, e-mails ou outros dados pessoais. Se essas colunas existirem, serão ignoradas.</p>
                <a href="/modelo-ceps-clientes.csv" download className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <Download className="mr-2 h-4 w-4" /> Baixar modelo CSV de CEPs
                </a>
              </div>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-orange-400 hover:bg-orange-50">
                <FileSpreadsheet className="h-10 w-10 text-orange-500" />
                <span className="mt-3 font-semibold text-slate-800">Selecionar arquivo CSV/XLSX de CEPs, opcional</span>
                <span className="mt-1 text-sm text-slate-500">Use o modelo CSV para começar rápido. Limite de 50MB. Apenas a coluna CEP será processada; a análise funciona mesmo sem arquivo.</span>
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
                  <p className="mt-2 text-sm text-slate-500">A análise usará o CNPJ carregado da empresa, os CNAEs selecionados, os tipos de concorrentes, o raio de {safeAnalysisRadiusKm} km e os CEPs de clientes, se enviados.</p>
                </div>
                <Button className="min-w-56" onClick={startAnalysis} disabled={!canAnalyze}>{loadingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />} Iniciar análise</Button>
              </div>
              {!canAnalyze && <p className="mt-4 text-sm text-slate-500">Para iniciar, primeiro carregue os dados da empresa com um CNPJ válido, selecione pelo menos um CNAE e um tipo de concorrente.</p>}
            </Card>
          </section>
        ) : (
          <Dashboard result={result} />
        )}
      </div>
    </main>
  );
}
