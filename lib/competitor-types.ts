// Este arquivo lista os tipos de concorrentes e locais que a ferramenta pode procurar.
// Cada tipo tambem tem termos de busca para ajudar o Google Places a encontrar resultados melhores.
export const COMPETITOR_TYPES = [
  'Todos',
  'Concorrentes diretos do ramo informado',
  'Concorrentes locais similares',
  'Redes e franquias do setor',
  'Substitutos e alternativas de compra',
  'Prestadores autônomos e pequenos negócios',
  'Marketplaces, delivery e canais digitais',
  'Polos geradores de público',
  'Negócios complementares para parceria',
  'Barreiras de acesso e conveniência',
  'Concorrentes bem avaliados no Google'
] as const;

export type CompetitorType = (typeof COMPETITOR_TYPES)[number];

export const DEFAULT_COMPETITOR_TYPES: CompetitorType[] = ['Todos'];
export const DEFAULT_COMPETITOR_TYPE: CompetitorType = 'Todos';

export function isCompetitorType(value: string): value is CompetitorType {
  return (COMPETITOR_TYPES as readonly string[]).includes(value);
}

export interface CompetitorTypeConfig {
  type: Exclude<CompetitorType, 'Todos'>;
  terms: string[];
  googleQueries: string[];
  strategicCategoryHint: 'direto' | 'indireto' | 'barreira' | 'polo' | 'parceria';
}

export const COMPETITOR_TYPE_CONFIGS: CompetitorTypeConfig[] = [
  {
    type: 'Concorrentes diretos do ramo informado',
    terms: ['concorrente', 'empresa', 'serviço', 'servico', 'loja', 'comércio', 'comercio', 'clínica', 'clinica', 'escritório', 'escritorio'],
    googleQueries: ['empresa do mesmo segmento', 'serviço do mesmo segmento', 'loja do mesmo segmento'],
    strategicCategoryHint: 'direto'
  },
  {
    type: 'Concorrentes locais similares',
    terms: ['similar', 'especializada', 'especializado', 'negócio local', 'negocio local'],
    googleQueries: ['negócios similares', 'empresas similares', 'serviços similares'],
    strategicCategoryHint: 'direto'
  },
  {
    type: 'Redes e franquias do setor',
    terms: ['franquia', 'rede', 'empresa', 'filial'],
    googleQueries: ['franquia do setor', 'rede do setor', 'empresa do setor'],
    strategicCategoryHint: 'direto'
  },
  {
    type: 'Substitutos e alternativas de compra',
    terms: ['alternativa', 'substituto', 'solução', 'solucao', 'serviço online', 'servico online'],
    googleQueries: ['alternativas ao serviço', 'serviços substitutos', 'opções similares'],
    strategicCategoryHint: 'indireto'
  },
  {
    type: 'Prestadores autônomos e pequenos negócios',
    terms: ['autônomo', 'autonomo', 'profissional liberal', 'consultor', 'freelancer', 'microempresa'],
    googleQueries: ['profissional autônomo', 'prestador de serviço', 'pequenas empresas'],
    strategicCategoryHint: 'indireto'
  },
  {
    type: 'Marketplaces, delivery e canais digitais',
    terms: ['marketplace', 'delivery', 'online', 'e-commerce', 'ecommerce', 'aplicativo', 'app'],
    googleQueries: ['marketplace do segmento', 'delivery do segmento', 'loja online do segmento'],
    strategicCategoryHint: 'indireto'
  },
  {
    type: 'Polos geradores de público',
    terms: ['shopping', 'centro comercial', 'galeria', 'mercado', 'terminal', 'estação', 'estacao', 'universidade', 'hospital'],
    googleQueries: ['shopping center', 'centro comercial', 'galeria comercial', 'polo comercial'],
    strategicCategoryHint: 'polo'
  },
  {
    type: 'Negócios complementares para parceria',
    terms: ['complementar', 'parceria', 'associação', 'associacao', 'coworking', 'fornecedor'],
    googleQueries: ['negócios complementares', 'fornecedores do setor', 'parceiros comerciais'],
    strategicCategoryHint: 'parceria'
  },
  {
    type: 'Barreiras de acesso e conveniência',
    terms: ['estacionamento', 'trânsito', 'transito', 'transporte', 'concorrência por conveniência', 'conveniencia'],
    googleQueries: ['estacionamento', 'transporte público', 'centro comercial com estacionamento'],
    strategicCategoryHint: 'barreira'
  },
  {
    type: 'Concorrentes bem avaliados no Google',
    terms: ['melhor avaliado', 'avaliação', 'avaliacao', 'recomendado', 'popular'],
    googleQueries: ['melhores avaliados', 'mais bem avaliados', 'recomendados'],
    strategicCategoryHint: 'direto'
  }
];

export function getActiveCompetitorTypes(selected: CompetitorType[] | CompetitorType | undefined): Exclude<CompetitorType, 'Todos'>[] {
  // Se o usuario escolhe "Todos", transformamos isso em todas as categorias reais.
  // Assim o resto do codigo nao precisa tratar "Todos" como um caso especial o tempo todo.
  const list = Array.isArray(selected) ? selected : selected ? [selected] : DEFAULT_COMPETITOR_TYPES;
  if (!list.length || list.includes('Todos')) return COMPETITOR_TYPE_CONFIGS.map((item) => item.type);
  return list.filter((item): item is Exclude<CompetitorType, 'Todos'> => item !== 'Todos' && isCompetitorType(item));
}

export function getConfigsForCompetitorTypes(selected: CompetitorType[] | CompetitorType | undefined): CompetitorTypeConfig[] {
  const active = new Set(getActiveCompetitorTypes(selected));
  return COMPETITOR_TYPE_CONFIGS.filter((item) => active.has(item.type));
}

export function getConfigsForCompetitorType(selected: CompetitorType[] | CompetitorType | undefined): CompetitorTypeConfig[] {
  return getConfigsForCompetitorTypes(selected);
}
