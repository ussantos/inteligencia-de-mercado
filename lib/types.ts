// Este arquivo descreve os formatos dos dados da aplicacao.
// Typescript usa estes "contratos" para avisar quando algum objeto esta faltando campos ou com nomes errados.
import type { CompetitorType } from '@/lib/competitor-types';

export type DomainOption = string;

export interface CnaeOption {
  codigo: string;
  descricao: string;
  tipo: 'Principal' | 'Secundário';
}

export type CategoriaEstrategica =
  | 'Concorrente direto'
  | 'Concorrente indireto'
  | 'Concorrente direto de tecnologia'
  | 'Concorrente indireto extracurricular'
  | 'Barreira potencial de agenda'
  | 'Barreira de acesso ou conveniência'
  | 'Escola regular mapeada'
  | 'Polo gerador de público'
  | 'Oportunidade de parceria'
  | 'Outro local relevante';

export interface UnidadeNegocio {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  cnaePrincipalCodigo: string;
  cnaePrincipalDescricao: string;
  cnaeSecundarios: string[];
  cnaes: CnaeOption[];
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string | null;
  email: string | null;
  porte: string | null;
  naturezaJuridica: string | null;
  capitalSocial: number | null;
  dataAbertura: string | null;
}

export interface CepPoint {
  cep: string;
  lat: number;
  lng: number;
  bairro: string;
  cidade: string;
  uf: string;
  endereco: string;
  distanciaLinhaRetaKm: number;
  distanciaCarroKm: number | null;
  tempoMin: number | null;
}

export interface StrategicPlace {
  nome: string;
  categoriaEstrategica: CategoriaEstrategica;
  subcategoria: string;
  competitorType?: CompetitorType;
  fonte: 'Google Places' | 'OpenStreetMap/Overpass' | 'Heurística local';
  googlePlaceId?: string;
  googleTypes?: string[];
  lat: number;
  lng: number;
  endereco?: string;
  bairro?: string;
  website?: string;
  telefone?: string;
  horarioFuncionamento?: string;
  distanciaKm?: number;
  rating?: number | null;
  userRatingCount?: number | null;
  confiabilidade: 'Alta' | 'Média' | 'Baixa';
  observacaoEstrategica: string;
}

export interface NeighborhoodScore {
  bairro: string;
  cidade: string;
  score: number;
  cepCount: number;
  distanciaMediaKm: number;
  concorrentesDiretos: number;
  concorrentesIndiretos: number;
  polosFamiliares: number;
  evidencias: string[];
  limitacoes: string[];
  acaoRecomendada: string;
}

export interface Persona {
  nomeFicticio: string;
  idade: string;
  perfilFamiliar: string;
  classeAbepEstimativa: string;
  filhoIdade: string;
  filhoPerfil: string;
  papelDoFilhoNaDecisao: string;
  decisorPrincipal?: string;
  perfilComprador?: string;
  papelNaDecisao?: string;
  motivacoes: string[];
  doresEObjecoes: string[];
  canaisPreferidos: string[];
  disponibilidadeDeCompra: string;
  gatilhosDeDecisao: string[];
  mensagemRecomendada: string;
}

export interface BusinessModelCanvas {
  propostaDeValor: string[];
  segmentosDeClientes: string[];
  canais: string[];
  relacionamentoComClientes: string[];
  fontesDeReceita: string[];
  recursosChave: string[];
  atividadesChave: string[];
  parceriasChave: string[];
  estruturaDeCustos: string[];
}

export interface AnalysisResult {
  id?: string;
  language?: 'pt-BR' | 'en-US';
  createdAt: string;
  domain: DomainOption;
  selectedCnaes: CnaeOption[];
  businessActivityDescription?: string;
  competitorTypes: CompetitorType[];
  analysisRadiusKm: number;
  unidade: UnidadeNegocio;
  unidadeGeo: { lat: number; lng: number; endereco: string };
  points: CepPoint[];
  invalidCeps: string[];
  strategicPlaces: StrategicPlace[];
  faseMercadoLocal: {
    fase: 'Mercado Emergente' | 'Mercado em Crescimento' | 'Mercado Maduro' | 'Mercado Saturado' | 'Mercado com Lacuna';
    justificativa: string;
    cor: 'verde' | 'amarelo' | 'laranja' | 'vermelho';
  };
  estatisticas: {
    totalEnviados: number;
    totalValidos: number;
    totalInvalidos: number;
    distanciaMediaKm: number;
    distanciaMedianaKm: number;
    topBairros: Array<{ bairro: string; cidade: string; total: number }>;
    distribuicaoDistancias: Array<{ faixa: string; total: number }>;
    indiceOportunidadeMercado: number;
  };
  perfilEconomico: NeighborhoodScore[];
  afinidadePorBairro: NeighborhoodScore[];
  obstaculosMatricula: Array<{
    bairro: string;
    tipoObstaculo: string;
    descricao: string;
    evidencias: string[];
    impactoEstimado: 'Alto' | 'Médio' | 'Baixo';
    acaoRecomendada: string;
    deveSerTestadoAntes: boolean;
  }>;
  posicionamentoUnidade: {
    forcasAtuais: string[];
    diferenciaisFrenteConcorrentes: string[];
    riscosDePosicionamento: string[];
    mensagensRecomendadas: string[];
    ajustesIncrementaisSugeridos: string[];
    hipotesesParaTestar: string[];
  };
  personas: Persona[];
  evolucaoIncremental: {
    manter: string[];
    melhorar: string[];
    adicionar: string[];
    testarAntesDeAlterar: string[];
    fazerSemPrejudicarOperacao: string[];
  };
  diagnosticoFontesPublicas: string[];
  recomendacoesInteligentes: {
    prioridadePrincipal: string;
    brechaCompetitiva: string;
    personaFoco: string;
    objecaoProvavel: string;
    respostaRecomendada: string;
    mensagemPronta: string;
  };
  businessModelCanvas: BusinessModelCanvas;
  planoDeAcao: Array<{
    prioridade: number;
    acao: string;
    tipo: 'Manter' | 'Melhorar' | 'Adicionar' | 'Testar';
    impactoEsperado: 'Alto' | 'Médio' | 'Baixo';
    facilidadeExecucao: 'Alta' | 'Média' | 'Baixa';
    prazoSugerido: string;
    custoEstimado: 'Gratuito' | 'Baixo' | 'Médio' | 'Alto';
    recursoGratuitoConfirmado: boolean;
    responsavelSugerido: string;
    kpiParaMedirSucesso: string;
  }>;
  proximaRevisaoRecomendada: string;
  iaAviso?: string;
  mudancasDesdeUltimaAnalise?: string[];
}
