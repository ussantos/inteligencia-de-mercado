// Centraliza textos e rotulos por idioma.
// A aplicacao mantem alguns codigos internos em PT-BR para nao quebrar regras ja existentes,
// mas exibe esses valores com o rotulo correto para o idioma escolhido.
import type { CompetitorType } from '@/lib/competitor-types';
import type { CategoriaEstrategica } from '@/lib/types';

export type AppLanguage = 'pt-BR' | 'en-US';

export const DEFAULT_LANGUAGE: AppLanguage = 'pt-BR';
export const LANGUAGE_STORAGE_KEY = 'market-intelligence-language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'pt-BR' || value === 'en-US';
}

export const LANGUAGE_OPTIONS: Array<{ code: AppLanguage; label: string; nativeLabel: string; description: string }> = [
  {
    code: 'pt-BR',
    label: 'Portuguese (Brazil)',
    nativeLabel: 'Português do Brasil',
    description: 'Usar a aplicação, análise e relatório em PT-BR.'
  },
  {
    code: 'en-US',
    label: 'English (US)',
    nativeLabel: 'English (US)',
    description: 'Use the app, analysis, and report in American English.'
  }
];

export const competitorTypeLabels: Record<AppLanguage, Record<CompetitorType, string>> = {
  'pt-BR': {
    Todos: 'Todos',
    'Concorrentes diretos do ramo informado': 'Concorrentes diretos do ramo informado',
    'Concorrentes locais similares': 'Concorrentes locais similares',
    'Redes e franquias do setor': 'Redes e franquias do setor',
    'Substitutos e alternativas de compra': 'Substitutos e alternativas de compra',
    'Prestadores autônomos e pequenos negócios': 'Prestadores autônomos e pequenos negócios',
    'Marketplaces, delivery e canais digitais': 'Marketplaces, delivery e canais digitais',
    'Polos geradores de público': 'Polos geradores de público',
    'Negócios complementares para parceria': 'Negócios complementares para parceria',
    'Barreiras de acesso e conveniência': 'Barreiras de acesso e conveniência',
    'Concorrentes bem avaliados no Google': 'Concorrentes bem avaliados no Google'
  },
  'en-US': {
    Todos: 'All',
    'Concorrentes diretos do ramo informado': 'Direct competitors in the stated activity',
    'Concorrentes locais similares': 'Similar local businesses',
    'Redes e franquias do setor': 'Chains and franchises',
    'Substitutos e alternativas de compra': 'Substitutes and buying alternatives',
    'Prestadores autônomos e pequenos negócios': 'Independent providers and small businesses',
    'Marketplaces, delivery e canais digitais': 'Marketplaces, delivery, and digital channels',
    'Polos geradores de público': 'Traffic generators',
    'Negócios complementares para parceria': 'Complementary businesses for partnerships',
    'Barreiras de acesso e conveniência': 'Access and convenience barriers',
    'Concorrentes bem avaliados no Google': 'Highly rated Google competitors'
  }
};

export const categoryLabels: Record<AppLanguage, Record<CategoriaEstrategica, string>> = {
  'pt-BR': {
    'Concorrente direto': 'Concorrente direto',
    'Concorrente indireto': 'Concorrente indireto',
    'Concorrente direto de tecnologia': 'Concorrente direto de tecnologia',
    'Concorrente indireto extracurricular': 'Concorrente indireto extracurricular',
    'Barreira potencial de agenda': 'Barreira potencial de agenda',
    'Barreira de acesso ou conveniência': 'Barreira de acesso ou conveniência',
    'Escola regular mapeada': 'Escola regular mapeada',
    'Polo gerador de público': 'Polo gerador de público',
    'Oportunidade de parceria': 'Oportunidade de parceria',
    'Outro local relevante': 'Outro local relevante'
  },
  'en-US': {
    'Concorrente direto': 'Direct competitor',
    'Concorrente indireto': 'Indirect competitor',
    'Concorrente direto de tecnologia': 'Direct technology competitor',
    'Concorrente indireto extracurricular': 'Indirect extracurricular competitor',
    'Barreira potencial de agenda': 'Potential schedule barrier',
    'Barreira de acesso ou conveniência': 'Access or convenience barrier',
    'Escola regular mapeada': 'Mapped regular school',
    'Polo gerador de público': 'Traffic generator',
    'Oportunidade de parceria': 'Partnership opportunity',
    'Outro local relevante': 'Other relevant place'
  }
};

export const phaseLabels: Record<AppLanguage, Record<string, string>> = {
  'pt-BR': {
    'Mercado Emergente': 'Mercado Emergente',
    'Mercado em Crescimento': 'Mercado em Crescimento',
    'Mercado Maduro': 'Mercado Maduro',
    'Mercado Saturado': 'Mercado Saturado',
    'Mercado com Lacuna': 'Mercado com Lacuna'
  },
  'en-US': {
    'Mercado Emergente': 'Emerging Market',
    'Mercado em Crescimento': 'Growing Market',
    'Mercado Maduro': 'Mature Market',
    'Mercado Saturado': 'Saturated Market',
    'Mercado com Lacuna': 'Market Gap'
  }
};

export const simpleValueLabels: Record<AppLanguage, Record<string, string>> = {
  'pt-BR': {
    Alto: 'Alto',
    Médio: 'Médio',
    Baixo: 'Baixo',
    Alta: 'Alta',
    Média: 'Média',
    Baixa: 'Baixa',
    Gratuito: 'Gratuito',
    Manter: 'Manter',
    Melhorar: 'Melhorar',
    Adicionar: 'Adicionar',
    Testar: 'Testar'
  },
  'en-US': {
    Alto: 'High',
    Médio: 'Medium',
    Baixo: 'Low',
    Alta: 'High',
    Média: 'Medium',
    Baixa: 'Low',
    Gratuito: 'Free',
    Manter: 'Keep',
    Melhorar: 'Improve',
    Adicionar: 'Add',
    Testar: 'Test',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
    Free: 'Free',
    Keep: 'Keep',
    Improve: 'Improve',
    Add: 'Add',
    Test: 'Test'
  }
};

export function competitorLabel(language: AppLanguage, type: CompetitorType) {
  return competitorTypeLabels[language][type] || type;
}

export function categoryLabel(language: AppLanguage, category: CategoriaEstrategica | string) {
  return categoryLabels[language][category as CategoriaEstrategica] || category;
}

export function phaseLabel(language: AppLanguage, phase: string) {
  return phaseLabels[language][phase] || phase;
}

export function simpleLabel(language: AppLanguage, value: string) {
  return simpleValueLabels[language][value] || value;
}
