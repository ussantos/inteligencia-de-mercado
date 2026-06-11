'use client';

// Tela principal da aplicacao.
// Ela foi desenhada para funcionar sem login: o visitante informa o tipo de negocio,
// escolhe uma localizacao e recebe uma analise regional objetiva.
import { AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet, Loader2, MapPin, Radar, ShieldCheck, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useEffect, useMemo, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Badge, Button, Card, Input } from '@/components/ui';
import { normalizeCep, isValidCep, detectCepColumn } from '@/lib/cep';
import { formatCep, formatCnpj } from '@/lib/utils';
import { COMPETITOR_TYPES, DEFAULT_COMPETITOR_TYPES, type CompetitorType } from '@/lib/competitor-types';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY, competitorLabel, isAppLanguage, type AppLanguage } from '@/lib/i18n';
import type { AnalysisResult, UnidadeNegocio } from '@/lib/types';

interface ParsedCeps {
  ceps: string[];
  errors: string[];
  sensitiveWarning: boolean;
}

interface UploadedBlob {
  blobName: string;
}

type BusinessMode = 'existing' | 'new';

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
  },
  {
    title: 'My Robot Business',
    href: 'https://www.myrobotbarra.com.br/my-robot-business.html',
    logo: 'https://www.myrobotbarra.com.br/assets/images/course-logos/my-robot-business.webp'
  }
];

function tr(language: AppLanguage, ptText: string, enText: string) {
  return language === 'en-US' ? enText : ptText;
}

function friendlyErrorMessage(language: AppLanguage) {
  return tr(
    language,
    'Algo não carregou como esperado. Esta aplicação roda com recursos limitados, apenas para testes. Clique em OK para limpar dados temporários deste site, recarregar a página e tentar novamente.',
    'Something did not load as expected. This app runs with limited resources for testing. Click OK to clear temporary data for this site, reload the page, and try again.'
  );
}

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

async function clearSiteCacheAndReload() {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    window.localStorage.clear();
    window.sessionStorage.clear();
  } finally {
    window.location.reload();
  }
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

  return { ceps: [], errors: ['Formato de arquivo não suportado. Use .csv ou .xlsx'], sensitiveWarning: false };
}

function clampAnalysisRadius(value: number) {
  if (!Number.isFinite(value)) return 4;
  return Math.min(20, Math.max(1, Math.round(value)));
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inferCompetitorOptions(activityDescription: string, language: AppLanguage): Array<{ type: CompetitorType; reason: string; suggested: boolean }> {
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

  const reasonsPt: Record<CompetitorType, string> = {
    Todos: 'Recomendado para uma primeira leitura ampla da região.',
    'Concorrentes diretos do ramo informado': 'Busca empresas com oferta parecida com o ramo descrito.',
    'Concorrentes locais similares': 'Encontra negócios parecidos mesmo quando usam outra descrição pública.',
    'Redes e franquias do setor': 'Mostra marcas estruturadas que competem por preço, confiança ou presença.',
    'Substitutos e alternativas de compra': 'Mapeia opções que resolvem o mesmo problema de outro jeito.',
    'Prestadores autônomos e pequenos negócios': 'Considera profissionais independentes e ofertas menores.',
    'Marketplaces, delivery e canais digitais': 'Inclui canais digitais, aplicativos e venda online quando fizer sentido.',
    'Polos geradores de público': 'Mostra locais que concentram fluxo e podem influenciar demanda.',
    'Negócios complementares para parceria': 'Encontra negócios que podem indicar clientes ou fazer ações conjuntas.',
    'Barreiras de acesso e conveniência': 'Observa fatores de acesso, conveniência e deslocamento.',
    'Concorrentes bem avaliados no Google': 'Prioriza negócios com reputação pública forte.'
  };
  const reasonsEn: Record<CompetitorType, string> = {
    Todos: 'Recommended for a broad first read of the region.',
    'Concorrentes diretos do ramo informado': 'Searches for businesses with an offer close to the stated activity.',
    'Concorrentes locais similares': 'Finds similar businesses even when their public description differs.',
    'Redes e franquias do setor': 'Shows structured brands that compete through price, trust, or presence.',
    'Substitutos e alternativas de compra': 'Maps options that solve the same problem in a different way.',
    'Prestadores autônomos e pequenos negócios': 'Considers independent providers and smaller offers.',
    'Marketplaces, delivery e canais digitais': 'Includes digital channels, apps, and online sales when relevant.',
    'Polos geradores de público': 'Shows places that concentrate traffic and may influence demand.',
    'Negócios complementares para parceria': 'Finds businesses that may refer customers or run joint actions.',
    'Barreiras de acesso e conveniência': 'Observes access, convenience, and travel factors.',
    'Concorrentes bem avaliados no Google': 'Prioritizes businesses with strong public reputation.'
  };
  const reasons = language === 'en-US' ? reasonsEn : reasonsPt;

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
  language: AppLanguage;
}): UnidadeNegocio {
  // Unidade manual representa um estudo de negocio novo, sem CNPJ aberto.
  const activity = input.businessActivityDescription.trim();
  const name = input.businessName.trim() || tr(input.language, `Estudo de mercado: ${activity}`, `Market study: ${activity}`);
  return {
    cnpj: '',
    razaoSocial: name,
    nomeFantasia: input.businessName.trim() || null,
    situacaoCadastral: tr(input.language, 'Estudo sem CNPJ', 'Study without company ID'),
    cnaePrincipalCodigo: '',
    cnaePrincipalDescricao: tr(input.language, 'Ramo informado manualmente', 'Manually stated business activity'),
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
  const [language, setLanguage] = useState<AppLanguage | null>(null);
  const [languageReady, setLanguageReady] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [unidade, setUnidade] = useState<UnidadeNegocio | null>(null);
  const [businessMode, setBusinessMode] = useState<BusinessMode | null>(null);
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
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [recoverableError, setRecoverableError] = useState<string | null>(null);
  const [manualCepFeedback, setManualCepFeedback] = useState<string | null>(null);
  const [blobWarning, setBlobWarning] = useState<string | null>(null);
  const [uploadedBlob, setUploadedBlob] = useState<UploadedBlob | null>(null);

  const activeLanguage = language || DEFAULT_LANGUAGE;
  const competitorOptions = useMemo(() => inferCompetitorOptions(businessActivityDescription, activeLanguage), [businessActivityDescription, activeLanguage]);
  const safeAnalysisRadiusKm = clampAnalysisRadius(analysisRadiusKm);
  const uniqueCeps = useMemo(() => [...new Set(ceps)], [ceps]);
  const isExistingFlow = businessMode === 'existing';
  const isNewBusinessFlow = businessMode === 'new';
  const hasExistingBusiness = Boolean(unidade?.cnpj);
  const resultStep = isExistingFlow && hasExistingBusiness ? 5 : 4;
  const hasMarketScope = businessActivityDescription.trim().length >= 3;
  const hasManualAddress = manualAddress.trim().length >= 5 && manualCity.trim().length >= 2 && manualUf.trim().length >= 2;
  const hasManualCep = isValidCep(normalizeCep(manualCep));
  const hasLocation = isExistingFlow ? hasExistingBusiness : isNewBusinessFlow && (hasManualCep || hasManualAddress);
  const hasRequiredBusinessName = isExistingFlow || businessName.trim().length >= 2;
  const canAnalyze = Boolean(businessMode) && hasRequiredBusinessName && hasMarketScope && hasLocation && competitorTypes.length > 0 && !loadingAnalysis;

  function chooseLanguage(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }

  function showRecoverableError(message?: string) {
    const friendlyMessage = friendlyErrorMessage(activeLanguage);
    setRecoverableError(message ? `${message} ${friendlyMessage}` : friendlyMessage);
  }

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(storedLanguage)) setLanguage(storedLanguage);
    setLanguageReady(true);
  }, []);

  useEffect(() => {
    function handleRuntimeError(event: ErrorEvent) {
      event.preventDefault();
      showRecoverableError(event.message || undefined);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      event.preventDefault();
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || '');
      showRecoverableError(reason || undefined);
    }

    window.addEventListener('error', handleRuntimeError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleRuntimeError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [activeLanguage]);

  useEffect(() => {
    const cep = normalizeCep(manualCep);
    if (!isNewBusinessFlow || cep.length < 8) {
      setManualCepFeedback(null);
      setLoadingCep(false);
      return;
    }

    if (!isValidCep(cep)) {
      setManualCepFeedback(tr(activeLanguage, 'Informe um CEP válido com 8 dígitos.', 'Enter a valid Brazilian ZIP/postal code with 8 digits.'));
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingCep(true);
      setManualCepFeedback(null);
      try {
        const response = await fetch('/api/cep', {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ cep }),
          signal: controller.signal
        });
        const json = await response.json() as { error?: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string };
        if (!response.ok) throw new Error(json.error || tr(activeLanguage, 'Não foi possível consultar o CEP.', 'Could not look up this ZIP/postal code.'));

        setManualAddress((current) => json.logradouro || current);
        setManualNeighborhood((current) => json.bairro || current);
        setManualCity((current) => json.cidade || current);
        setManualUf((current) => (json.uf || current || '').toUpperCase().slice(0, 2));
        setManualCepFeedback(tr(activeLanguage, 'CEP encontrado. Endereço preenchido automaticamente; revise número e complemento, se necessário.', 'ZIP/postal code found. Address fields were filled automatically; review number and complement if needed.'));
      } catch (error) {
        if (controller.signal.aborted) return;
        setManualCepFeedback(error instanceof Error ? error.message : tr(activeLanguage, 'Não foi possível consultar o CEP.', 'Could not look up this ZIP/postal code.'));
      } finally {
        if (!controller.signal.aborted) setLoadingCep(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [manualCep, isNewBusinessFlow, activeLanguage]);

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
      if (!response.ok) throw new Error(json.error || tr(activeLanguage, 'Erro ao consultar CNPJ.', 'Could not look up the company ID.'));
      const found = json.unidade as UnidadeNegocio;
      setUnidade(found);
      setBusinessName(found.nomeFantasia || found.razaoSocial || businessName);
      if (!businessActivityDescription.trim() && found.cnaePrincipalDescricao) {
        setBusinessActivityDescription(found.cnaePrincipalDescricao);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : tr(activeLanguage, 'Erro ao consultar CNPJ.', 'Could not look up the company ID.');
      setGlobalError(message);
      showRecoverableError(message);
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

  function chooseBusinessMode(mode: BusinessMode) {
    setBusinessMode(mode);
    setGlobalError(null);
    if (mode === 'new') {
      void clearExistingBusiness();
    }
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
      setBlobWarning(tr(activeLanguage, `${parsed.ceps.length} CEP(s) lido(s). A análise usará apenas esses CEPs, sem nomes, telefones ou e-mails.`, `${parsed.ceps.length} ZIP/postal code(s) read. The analysis will use only these codes, without names, phone numbers, or emails.`));
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const upload = await fetch('/api/blob/upload', { method: 'POST', headers: requestHeaders(), body: formData });
      const data = await upload.json() as { error?: string; blobName?: string };
      if (!upload.ok || !data.blobName) throw new Error(data.error || tr(activeLanguage, 'Não foi possível enviar o arquivo temporário.', 'Could not upload the temporary file.'));
      setUploadedBlob({ blobName: data.blobName });
      if (parsed.ceps.length) setBlobWarning(tr(activeLanguage, `${parsed.ceps.length} CEP(s) lido(s). O arquivo temporário será apagado depois da análise.`, `${parsed.ceps.length} ZIP/postal code(s) read. The temporary file will be deleted after the analysis.`));
    } catch {
      if (parsed.ceps.length) {
        setBlobWarning(tr(activeLanguage, 'CEPs lidos com sucesso. O upload temporário ao Azure Blob não foi concluído, mas a análise pode continuar porque os CEPs já foram processados no navegador.', 'ZIP/postal codes were read successfully. The temporary upload to Azure Blob did not complete, but the analysis can continue because the codes were already processed in the browser.'));
      } else {
        setBlobWarning(tr(activeLanguage, 'O upload temporário não foi concluído. Verifique se o arquivo tem uma coluna chamada CEP e tente novamente.', 'The temporary upload did not complete. Check that the file has a column named CEP and try again.'));
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
      manualUf,
      language: activeLanguage
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
          analysisRadiusKm: radiusKm,
          language: activeLanguage
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || tr(activeLanguage, 'Erro ao processar análise.', 'Could not process the analysis.'));
      setResult(json.result);
      if (uploadedBlob) {
        const deleted = await deleteTemporaryBlob(uploadedBlob);
        setUploadedBlob(null);
        setBlobWarning(deleted
          ? tr(activeLanguage, 'Análise concluída e arquivo temporário apagado do Azure Blob Storage.', 'Analysis completed and the temporary file was deleted from Azure Blob Storage.')
          : tr(activeLanguage, 'Análise concluída. Não foi possível confirmar a exclusão do arquivo temporário; verifique as permissões do Azure Blob Storage.', 'Analysis completed. The temporary file deletion could not be confirmed; check Azure Blob Storage permissions.'));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message = error instanceof Error ? error.message : tr(activeLanguage, 'Erro ao processar análise.', 'Could not process the analysis.');
      setGlobalError(message);
      showRecoverableError(message);
    } finally {
      setLoadingAnalysis(false);
    }
  }

  if (!languageReady) {
    return <main className="min-h-screen bg-slate-100" />;
  }

  if (!language) {
    return <LanguageSelection onSelect={chooseLanguage} />;
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Header language={activeLanguage} onLanguageChange={chooseLanguage} />
        {recoverableError && (
          <FriendlyErrorDialog
            message={recoverableError}
            language={activeLanguage}
            onConfirm={() => {
              setRecoverableError(null);
              void clearSiteCacheAndReload();
            }}
          />
        )}
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <div className="no-print mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {tr(activeLanguage, 'Nova análise', 'New analysis')}
            </button>
          </div>
          <Dashboard result={result} language={activeLanguage} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Header language={activeLanguage} onLanguageChange={chooseLanguage} />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <CourseReferences language={activeLanguage} />

        {recoverableError && (
          <FriendlyErrorDialog
            message={recoverableError}
            language={activeLanguage}
            onConfirm={() => {
              setRecoverableError(null);
              void clearSiteCacheAndReload();
            }}
          />
        )}

        <Card className="mb-6 border-orange-200 bg-orange-50">
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 flex-none text-orange-600" />
            <div>
              <h2 className="font-semibold text-slate-900">{tr(activeLanguage, 'Aviso LGPD', 'LGPD notice')}</h2>
              <p className="mt-1 text-sm text-slate-700">
                {tr(
                  activeLanguage,
                  'A ferramenta usa apenas os dados necessários para gerar a análise. CNPJ e endereço ajudam a localizar a região; CEPs de clientes, quando enviados, são opcionais e processados sem nomes, telefones ou e-mails.',
                  'The tool uses only the data needed to generate the analysis. Company ID and address help locate the region; customer ZIP/postal codes, when uploaded, are optional and processed without names, phone numbers, or emails.'
                )}
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
            <Badge className="bg-slate-100 text-slate-600">{tr(activeLanguage, '1 — Negócio e região', '1 — Business and region')}</Badge>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{tr(activeLanguage, 'Que negócio você quer analisar?', 'Which business do you want to analyze?')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {tr(
                activeLanguage,
                'Primeiro informe se a empresa já existe. Depois a ferramenta pede apenas os dados necessários para localizar a região e entender o ramo de atuação.',
                'First tell us whether the company already exists. Then the tool asks only for the data needed to locate the region and understand the business activity.'
              )}
            </p>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">{tr(activeLanguage, 'Você já possui uma empresa?', 'Do you already have a company?')}</p>
              <p className="mt-1 text-sm text-slate-500">{tr(activeLanguage, 'Escolha Sim para consultar um CNPJ existente, ou Não para estudar um novo ponto comercial.', 'Choose Yes to look up an existing Brazilian company ID, or No to study a new business location.')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseBusinessMode('existing')}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${isExistingFlow ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                >
                  <span className="block font-bold text-slate-900">{tr(activeLanguage, 'Sim, já tenho uma empresa', 'Yes, I already have a company')}</span>
                  <span className="mt-1 block text-sm text-slate-500">{tr(activeLanguage, 'Vou informar o CNPJ para carregar dados cadastrais.', 'I will enter the company ID to load registration data.')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseBusinessMode('new')}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${isNewBusinessFlow ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                >
                  <span className="block font-bold text-slate-900">{tr(activeLanguage, 'Não, estou estudando abrir uma empresa', 'No, I am studying a new business')}</span>
                  <span className="mt-1 block text-sm text-slate-500">{tr(activeLanguage, 'Vou informar nome pretendido e endereço de referência.', 'I will enter the intended name and reference address.')}</span>
                </button>
              </div>
            </div>

            {isExistingFlow && (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
                <p className="text-sm font-semibold text-slate-800">{tr(activeLanguage, 'Informe o CNPJ da empresa', 'Enter the company ID')}</p>
                <p className="mt-1 text-sm text-slate-500">{tr(activeLanguage, 'A consulta preenche dados cadastrais, localiza a empresa e libera a etapa opcional de CEPs de clientes.', 'The lookup fills registration data, locates the business, and enables the optional customer ZIP/postal-code step.')}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="CNPJ — ex: 12.345.678/0001-90" />
                  <Button className="whitespace-normal text-center md:whitespace-nowrap" onClick={handleCnpjLookup} disabled={loadingCnpj || cnpj.replace(/\D/g, '').length < 14}>
                    {loadingCnpj ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
                    {tr(activeLanguage, 'Consultar CNPJ', 'Look up company ID')}
                  </Button>
                </div>

                {unidade && (
                  <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-800">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        {tr(activeLanguage, 'Empresa encontrada', 'Company found')}
                      </div>
                      <button type="button" onClick={clearExistingBusiness} className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50">
                        <Trash2 className="mr-1 h-3 w-3" />
                        {tr(activeLanguage, 'Remover CNPJ', 'Remove company ID')}
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <p><strong>{tr(activeLanguage, 'Razão Social:', 'Legal name:')}</strong> {unidade.razaoSocial}</p>
                      <p><strong>{tr(activeLanguage, 'Nome Fantasia:', 'Trade name:')}</strong> {unidade.nomeFantasia || tr(activeLanguage, 'Não informado', 'Not provided')}</p>
                      <p><strong>CNPJ:</strong> {formatCnpj(unidade.cnpj)}</p>
                      <p><strong>{tr(activeLanguage, 'Situação:', 'Status:')}</strong> {unidade.situacaoCadastral}</p>
                      <p><strong>CEP:</strong> {formatCep(unidade.cep)}</p>
                      <p className="md:col-span-2"><strong>{tr(activeLanguage, 'Endereço:', 'Address:')}</strong> {unidade.logradouro}, {unidade.numero} — {unidade.bairro}, {unidade.municipio}/{unidade.uf}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isNewBusinessFlow && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  {tr(activeLanguage, 'Dados do novo negócio', 'New business data')}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {tr(
                    activeLanguage,
                    'Informe o nome pretendido e a localização onde você imagina abrir a empresa. Um CEP válido já ajuda bastante; endereço, cidade e UF deixam a leitura mais precisa.',
                    'Enter the intended name and the location where you plan to open the business. A valid Brazilian ZIP/postal code already helps; street, city, and state make the reading more precise.'
                  )}
                </p>
                <div className="mt-4">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="business-name">{tr(activeLanguage, 'Nome pretendido para a empresa', 'Intended business name')}</label>
                  <Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder={tr(activeLanguage, 'Ex: Padaria do Bairro', 'Ex: Neighborhood Bakery')} />
                </div>
                <div className="mt-4">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="manual-cep">{tr(activeLanguage, 'CEP de referência', 'Reference ZIP/postal code')} <span className="text-slate-400">{tr(activeLanguage, '(preenche o endereço automaticamente)', '(fills the address automatically)')}</span></label>
                  <Input id="manual-cep" value={manualCep} onChange={(event) => setManualCep(event.target.value)} placeholder="Ex: 22775-003" />
                  <div className="mt-2 min-h-5 text-xs text-slate-500">
                    {loadingCep ? tr(activeLanguage, 'Consultando CEP...', 'Looking up ZIP/postal code...') : manualCepFeedback}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
                  <Input value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} placeholder={tr(activeLanguage, 'Rua, avenida ou ponto de referência', 'Street, avenue, or reference point')} />
                  <Input value={manualNumber} onChange={(event) => setManualNumber(event.target.value)} placeholder={tr(activeLanguage, 'Número', 'Number')} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.5fr_1.5fr_0.7fr]">
                  <Input value={manualNeighborhood} onChange={(event) => setManualNeighborhood(event.target.value)} placeholder={tr(activeLanguage, 'Bairro', 'Neighborhood')} />
                  <Input value={manualCity} onChange={(event) => setManualCity(event.target.value)} placeholder={tr(activeLanguage, 'Cidade', 'City')} />
                  <Input value={manualUf} onChange={(event) => setManualUf(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" />
                </div>
              </div>
            )}

            {businessMode && (
              <div className="mt-5">
                <label className="text-sm font-semibold text-slate-800" htmlFor="business-activity-description">{tr(activeLanguage, 'Ramo de atuação', 'Business activity')} <span className="text-orange-600">{tr(activeLanguage, '(obrigatório)', '(required)')}</span></label>
                <textarea
                  id="business-activity-description"
                  value={businessActivityDescription}
                  onChange={(event) => setBusinessActivityDescription(event.target.value.slice(0, 300))}
                  placeholder={tr(activeLanguage, 'Ex: restaurante italiano de bairro com foco em almoço executivo e delivery', 'Ex: neighborhood Italian restaurant focused on lunch and delivery')}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{tr(activeLanguage, 'Quanto mais específico, mais coerente será a busca por concorrentes.', 'The more specific you are, the more coherent the competitor search will be.')}</span>
                  <span>{businessActivityDescription.length}/300</span>
                </div>
              </div>
            )}
          </Card>

          {businessMode && (
            <>
          <Card>
            <Badge className="bg-slate-100 text-slate-600">{tr(activeLanguage, '2 — Concorrência', '2 — Competition')}</Badge>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{tr(activeLanguage, 'Quais concorrentes devem entrar na leitura?', 'Which competitors should be included?')}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {tr(activeLanguage, 'Para vender melhor, a primeira análise pode ficar em', 'For a better first read, the initial analysis can stay on')} <strong>{tr(activeLanguage, 'Todos', 'All')}</strong>. {tr(activeLanguage, 'Se você quiser uma leitura mais focada, escolha categorias específicas.', 'If you want a more focused read, choose specific categories.')}
            </p>
            {businessActivityDescription.trim() && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {tr(activeLanguage, 'A busca vai priorizar concorrentes relacionados a:', 'The search will prioritize competitors related to:')} <strong>{businessActivityDescription.trim()}</strong>.
              </div>
            )}
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {competitorOptions.map((option) => (
                <label key={option.type} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm hover:bg-slate-50 ${option.suggested ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={competitorTypes.includes(option.type)} onChange={() => toggleCompetitorType(option.type)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="font-semibold text-slate-900">{competitorLabel(activeLanguage, option.type)}</span>
                    {option.suggested && <Badge className="ml-2 bg-orange-100 text-orange-700">{tr(activeLanguage, 'Sugerido', 'Suggested')}</Badge>}
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <Badge className="bg-slate-100 text-slate-600">{tr(activeLanguage, '3 — Raio de análise', '3 — Analysis radius')}</Badge>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{tr(activeLanguage, 'Escolha até onde olhar ao redor', 'Choose how far around the location to look')}</h2>
            <p className="mt-2 text-sm text-slate-500">{tr(activeLanguage, 'Comece com 4 km para negócios locais. Aumente se o cliente costuma se deslocar ou se o serviço tem alcance regional.', 'Start with 4 km for local businesses. Increase it if customers usually travel or if the service has regional reach.')}</p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-700">{tr(activeLanguage, 'Raio em torno da localização', 'Radius around the location')}</span>
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
                <span>{tr(activeLanguage, '4 km sugerido', '4 km suggested')}</span>
                <span>20 km</span>
              </div>
            </div>
          </Card>

          {hasExistingBusiness && (
            <Card>
              <Badge className="bg-slate-100 text-slate-600">{tr(activeLanguage, '4 — Clientes atuais', '4 — Current customers')}</Badge>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{tr(activeLanguage, 'CEPs de clientes', 'Customer ZIP/postal codes')} <span className="text-slate-400">{tr(activeLanguage, '(opcional)', '(optional)')}</span></h2>
              <>
                <p className="mt-2 text-sm text-slate-500">
                  {tr(activeLanguage, 'Como você informou um CNPJ, pode enviar CEPs de clientes atuais para entender onde sua base real aparece. Se não tiver planilha, pule esta etapa.', 'Because you entered a company ID, you can upload current customer ZIP/postal codes to understand where your real base appears. If you do not have a spreadsheet, skip this step.')}
                </p>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p><strong>{tr(activeLanguage, 'Formato aceito:', 'Accepted format:')}</strong> {tr(activeLanguage, 'uma coluna chamada', 'one column named')} <code className="rounded bg-white px-1 py-0.5">cep</code>. {tr(activeLanguage, 'Pode usar', 'You can use')} <code className="rounded bg-white px-1 py-0.5">22775003</code>, <code className="rounded bg-white px-1 py-0.5">22775-003</code> {tr(activeLanguage, 'ou', 'or')} <code className="rounded bg-white px-1 py-0.5">22.775-003</code>.</p>
                  <a href="/modelo-ceps-clientes.csv" download className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <Download className="mr-2 h-4 w-4" />
                    {tr(activeLanguage, 'Baixar modelo CSV de CEPs', 'Download ZIP/postal-code CSV template')}
                  </a>
                </div>
                <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-orange-400 hover:bg-orange-50">
                  <FileSpreadsheet className="h-10 w-10 text-orange-500" />
                  <span className="mt-3 font-semibold text-slate-800">{tr(activeLanguage, 'Selecionar arquivo CSV/XLSX de CEPs', 'Select a CSV/XLSX file with ZIP/postal codes')}</span>
                  <span className="mt-1 text-sm text-slate-500">{tr(activeLanguage, 'Apenas a coluna CEP será processada. Limite de 50MB.', 'Only the ZIP/postal-code column will be processed. 50MB limit.')}</span>
                  <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => handleFile(event.target.files?.[0] || null)} />
                </label>
                {sensitiveWarning && <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-800">{tr(activeLanguage, 'Foram identificadas colunas desnecessárias. Apenas os CEPs serão processados.', 'Unnecessary columns were detected. Only ZIP/postal codes will be processed.')}</p>}
                {blobWarning && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{blobWarning}</p>}
                {errors.length > 0 && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div>}
                {uniqueCeps.length > 0 && (
                  <div className="mt-5">
                    <h3 className="font-semibold text-slate-900">{tr(activeLanguage, 'Pré-visualização dos CEPs', 'ZIP/postal-code preview')}</h3>
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
                <Badge className="bg-orange-100 text-orange-700">{resultStep} — {tr(activeLanguage, 'Resultado', 'Result')}</Badge>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{tr(activeLanguage, 'Gerar análise de mercado', 'Generate market analysis')}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {tr(activeLanguage, 'A ferramenta vai analisar', 'The tool will analyze')} {businessActivityDescription.trim() || tr(activeLanguage, 'o ramo informado', 'the stated activity')} {tr(activeLanguage, 'em um raio de', 'within a')} {safeAnalysisRadiusKm} km {tr(activeLanguage, 'usando', 'radius, using')} {hasExistingBusiness ? tr(activeLanguage, 'o endereço do CNPJ', 'the company ID address') : tr(activeLanguage, 'a localização informada', 'the entered location')}.
                </p>
              </div>
              <Button className="min-w-52" onClick={startAnalysis} disabled={!canAnalyze}>
                {loadingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                {tr(activeLanguage, 'Analisar região', 'Analyze region')}
              </Button>
            </div>
            {!canAnalyze && (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900">
                <p className="font-bold">{tr(activeLanguage, 'Para liberar o botão, preencha:', 'To enable the button, fill in:')}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {!businessMode && <li>{tr(activeLanguage, 'Informe se você já possui uma empresa.', 'Tell us whether you already have a company.')}</li>}
                  {isExistingFlow && !hasExistingBusiness && <li>{tr(activeLanguage, 'Consulte um CNPJ válido.', 'Look up a valid company ID.')}</li>}
                  {isNewBusinessFlow && !hasRequiredBusinessName && <li>{tr(activeLanguage, 'Informe o nome pretendido da nova empresa.', 'Enter the intended new business name.')}</li>}
                  {!hasMarketScope && <li>{tr(activeLanguage, 'Descreva o ramo de atuação com pelo menos 3 caracteres.', 'Describe the business activity with at least 3 characters.')}</li>}
                  {businessMode && !hasLocation && <li>{tr(activeLanguage, 'Informe uma localização por CEP válido ou por endereço, cidade e UF.', 'Enter a location using a valid ZIP/postal code or street, city, and state.')}</li>}
                  {competitorTypes.length === 0 && <li>{tr(activeLanguage, 'Selecione pelo menos um tipo de concorrente.', 'Select at least one competitor type.')}</li>}
                </ul>
              </div>
            )}
          </Card>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function LanguageSelection({ onSelect }: { onSelect: (language: AppLanguage) => void }) {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 md:px-8">
        <Card className="w-full">
          <div className="text-center">
            <Badge className="bg-orange-100 text-orange-700">Market Intelligence</Badge>
            <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Escolha seu idioma / Choose your language</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Selecione o idioma para usar a aplicação, gerar a análise e preparar o relatório.
              <br />
              Select the language for the app, analysis, and printable report.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => onSelect(option.code)}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-orange-300 hover:bg-orange-50 hover:shadow-sm"
              >
                <span className="text-lg font-bold text-slate-900">{option.nativeLabel}</span>
                <span className="mt-1 block text-sm text-slate-500">{option.label}</span>
                <span className="mt-4 block text-sm leading-6 text-slate-600">{option.description}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}

function Header({ language, onLanguageChange }: { language: AppLanguage; onLanguageChange: (language: AppLanguage) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur no-print">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">{tr(language, 'Inteligência de Mercado', 'Market Intelligence')}</p>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{tr(language, 'Análise regional de mercado', 'Regional market analysis')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as AppLanguage)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-orange-300"
            aria-label={tr(language, 'Idioma da aplicação', 'Application language')}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>{option.code}</option>
            ))}
          </select>
          <a
            href="https://www.myrobotbarra.com.br/"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-orange-300 hover:text-orange-600 md:inline-flex"
          >
            <img
              src="https://www.myrobotbarra.com.br/assets/images/logo.webp"
              alt="My Robot Barra da Tijuca"
              className="h-8 w-auto object-contain"
            />
            <span>My Robot Barra da Tijuca</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function FriendlyErrorDialog({ message, language, onConfirm }: { message: string; language: AppLanguage; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div role="alertdialog" aria-modal="true" className="max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 flex-none text-orange-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">{tr(language, 'Vamos tentar novamente', 'Let’s try again')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
          >
            {tr(language, 'OK, limpar e recarregar', 'OK, clear and reload')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseReferences({ language }: { language: AppLanguage }) {
  return (
    <Card className="mb-6">
      <div className="grid gap-5 md:grid-cols-[1.1fr_1.2fr] md:items-center">
        <div>
          <Badge className="bg-orange-100 text-orange-700">{tr(language, 'Projeto educacional aplicado', 'Applied educational project')}</Badge>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">{tr(language, 'Ferramenta criada para praticar IA, dados e desenvolvimento de apps', 'A tool created to practice AI, data, and app development')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {tr(
              language,
              'Esta aplicação demonstra, em uma experiência prática, conceitos ensinados nos cursos de Inteligência Artificial, App Developer e My Robot Business da My Robot Barra da Tijuca.',
              'This application demonstrates, through a practical experience, concepts taught in the Artificial Intelligence, App Developer, and My Robot Business courses from My Robot Barra da Tijuca.'
            )}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
