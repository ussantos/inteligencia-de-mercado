import { prisma } from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';
import { DEFAULT_COMPETITOR_TYPE, getConfigsForCompetitorType, type CompetitorType, type CompetitorTypeConfig } from '@/lib/competitor-types';
import type { CategoriaEstrategica, StrategicPlace, UnidadeNegocio } from '@/lib/types';

const TTL_30_DAYS = 30 * 24 * 60 * 60 * 1000;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegexTerm(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function categoryFromHint(hint: CompetitorTypeConfig['strategicCategoryHint']): CategoriaEstrategica {
  if (hint === 'direto') return 'Concorrente direto';
  if (hint === 'barreira') return 'Barreira de acesso ou conveniência';
  if (hint === 'polo') return 'Polo gerador de público';
  if (hint === 'parceria') return 'Oportunidade de parceria';
  return 'Concorrente indireto';
}

function classifyByTags(tags: Record<string, string>): { categoria: CategoriaEstrategica; subcategoria: string; confiabilidade: 'Alta' | 'Média' | 'Baixa'; observacao: string } {
  if (tags.amenity === 'school' || tags.amenity === 'kindergarten') {
    return {
      categoria: 'Escola regular mapeada',
      subcategoria: 'Escola regular ou educação infantil',
      confiabilidade: 'Média',
      observacao: 'Pode ser polo de famílias, oportunidade de relacionamento ou barreira de agenda, dependendo da rotina escolar.'
    };
  }
  if (tags.amenity === 'language_school' || tags.amenity === 'music_school' || tags.amenity === 'arts_centre') {
    return {
      categoria: 'Concorrente indireto',
      subcategoria: 'Oferta substituta ou concorrente indireta',
      confiabilidade: 'Média',
      observacao: 'Pode competir por atenção, orçamento ou conveniência do mesmo público-alvo.'
    };
  }
  if (tags.leisure === 'sports_centre' || tags.leisure === 'fitness_centre' || tags.sport || tags.club) {
    return {
      categoria: 'Concorrente indireto',
      subcategoria: 'Esporte, clube ou atividade física/recreativa',
      confiabilidade: 'Média',
      observacao: 'Pode disputar orçamento, tempo ou fluxo com a oferta analisada.'
    };
  }
  if (tags.shop === 'mall' || tags.leisure === 'park' || tags.amenity === 'community_centre' || tags.amenity === 'place_of_worship') {
    return {
      categoria: 'Polo gerador de público',
      subcategoria: 'Local de concentração de famílias',
      confiabilidade: 'Média',
      observacao: 'Pode apoiar ações locais, parcerias, eventos ou divulgação regional.'
    };
  }
  return {
    categoria: 'Outro local relevante',
    subcategoria: tags.amenity || tags.shop || tags.leisure || tags.office || tags.club || tags.sport || 'POI',
    confiabilidade: 'Baixa',
    observacao: 'Local mapeado no entorno, mas sem evidência suficiente de relação direta. Validar manualmente antes de usar como concorrente.'
  };
}

function classify(tags: Record<string, string>, configs: CompetitorTypeConfig[]): { categoria: CategoriaEstrategica; subcategoria: string; confiabilidade: 'Alta' | 'Média' | 'Baixa'; observacao: string; competitorType?: CompetitorType } {
  const name = tags.name || tags.operator || '';
  const searchable = normalizeText([name, tags.description, tags.brand, tags.operator, tags.amenity, tags.shop, tags.leisure, tags.office, tags.club, tags.sport].filter(Boolean).join(' '));

  for (const config of configs) {
    const matched = config.terms.some((term) => searchable.includes(normalizeText(term)));
    if (matched) {
      const categoria = categoryFromHint(config.strategicCategoryHint);
      const obs = categoria === 'Concorrente direto'
        ? 'O nome ou descrição sugere atuação próxima ao segmento analisado.'
        : categoria === 'Barreira de acesso ou conveniência'
          ? 'Pode indicar barreira de acesso, conveniência ou fluxo que precisa ser validada no atendimento.'
          : categoria === 'Polo gerador de público'
            ? 'Pode concentrar famílias e apoiar parcerias, eventos ou ações locais.'
            : 'Pode competir por atenção, orçamento ou conveniência do mesmo público-alvo.';
      return {
        categoria,
        subcategoria: config.type,
        confiabilidade: 'Alta',
        observacao: obs,
        competitorType: config.type
      };
    }
  }

  const tagClassification = classifyByTags(tags);
  return tagClassification;
}

function buildNameRegex(configs: CompetitorTypeConfig[]) {
  const terms = unique(configs.flatMap((config) => config.terms)).map(escapeRegexTerm);
  return terms.length ? terms.join('|') : 'empresa|serviço|servico|loja|comércio|comercio|clínica|clinica|curso|consultoria';
}

function buildOverpassQuery(lat: number, lng: number, radiusM: number, competitorType: CompetitorType) {
  const configs = getConfigsForCompetitorType(competitorType);
  const terms = buildNameRegex(configs);
  return `
[out:json][timeout:45];
(
  node["name"~"${terms}",i](around:${radiusM},${lat},${lng});
  way["name"~"${terms}",i](around:${radiusM},${lat},${lng});
  relation["name"~"${terms}",i](around:${radiusM},${lat},${lng});

  node["amenity"~"school|kindergarten|language_school|music_school|arts_centre|college|training|community_centre|place_of_worship|social_centre|theatre|library|events_venue|internet_cafe"](around:${radiusM},${lat},${lng});
  way["amenity"~"school|kindergarten|language_school|music_school|arts_centre|college|training|community_centre|place_of_worship|social_centre|theatre|library|events_venue|internet_cafe"](around:${radiusM},${lat},${lng});
  relation["amenity"~"school|kindergarten|language_school|music_school|arts_centre|college|training|community_centre|place_of_worship|social_centre|theatre|library|events_venue|internet_cafe"](around:${radiusM},${lat},${lng});

  node["leisure"~"sports_centre|fitness_centre|dance|park|pitch|swimming_pool|playground|amusement_arcade"](around:${radiusM},${lat},${lng});
  way["leisure"~"sports_centre|fitness_centre|dance|park|pitch|swimming_pool|playground|amusement_arcade"](around:${radiusM},${lat},${lng});
  relation["leisure"~"sports_centre|fitness_centre|dance|park|pitch|swimming_pool|playground|amusement_arcade"](around:${radiusM},${lat},${lng});

  node["shop"~"mall|books|sports|music|video|toys"](around:${radiusM},${lat},${lng});
  way["shop"~"mall|books|sports|music|video|toys"](around:${radiusM},${lat},${lng});
  relation["shop"~"mall|books|sports|music|video|toys"](around:${radiusM},${lat},${lng});

  node["office"~"educational_institution|company"](around:${radiusM},${lat},${lng});
  way["office"~"educational_institution|company"](around:${radiusM},${lat},${lng});
  relation["office"~"educational_institution|company"](around:${radiusM},${lat},${lng});

  node["sport"](around:${radiusM},${lat},${lng});
  way["sport"](around:${radiusM},${lat},${lng});
  relation["sport"](around:${radiusM},${lat},${lng});

  node["club"](around:${radiusM},${lat},${lng});
  way["club"](around:${radiusM},${lat},${lng});
  relation["club"](around:${radiusM},${lat},${lng});
);
out center tags 250;
`;
}

function formatAddress(tags: Record<string, string>) {
  return [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ');
}

export async function getStrategicPlaces(input: {
  center: { lat: number; lng: number; cep: string };
  domain: string;
  unidade: UnidadeNegocio;
  competitorType?: CompetitorType;
  radiusM?: number;
}): Promise<StrategicPlace[]> {
  const radiusM = input.radiusM || 12000;
  const competitorType = input.competitorType || DEFAULT_COMPETITOR_TYPE;
  const cacheKey = `${input.center.cep}:${input.domain}:${input.unidade.cnaePrincipalCodigo}:${competitorType}:${radiusM}`;
  const cached = await prisma.placesCache.findFirst({ where: { cacheKey, expiresAt: { gt: new Date() } } });
  if (cached) return cached.resultsJson as unknown as StrategicPlace[];

  const configs = getConfigsForCompetitorType(competitorType);
  const query = buildOverpassQuery(input.center.lat, input.center.lng, radiusM, competitorType);
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query })
  });

  if (!response.ok) return [];
  const json = await response.json();
  const ownNames = [input.unidade.razaoSocial, input.unidade.nomeFantasia].filter(Boolean).map((x) => normalizeText(String(x)));
  const seen = new Set<string>();

  type OverpassElement = {
    id?: number | string;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  };

  const elements: OverpassElement[] = Array.isArray(json.elements) ? json.elements : [];

  const mappedPlaces: Array<StrategicPlace | null> = elements.map((element: OverpassElement): StrategicPlace | null => {
    const tags: Record<string, string> = element.tags || {};
    const name = tags.name || tags.operator || 'Local sem nome';
    if (ownNames.some((own) => own && normalizeText(String(name)).includes(own))) return null;
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const dedupKey = `${normalizeText(String(name))}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (seen.has(dedupKey)) return null;
    seen.add(dedupKey);
    const classification = classify(tags, configs);
    return {
      nome: String(name),
      categoriaEstrategica: classification.categoria,
      subcategoria: classification.subcategoria,
      competitorType: classification.competitorType,
      fonte: 'OpenStreetMap/Overpass' as const,
      lat,
      lng,
      endereco: formatAddress(tags) || undefined,
      website: tags.website || tags['contact:website'] || undefined,
      telefone: tags.phone || tags['contact:phone'] || undefined,
      horarioFuncionamento: tags.opening_hours || undefined,
      distanciaKm: haversineKm(input.center, { lat, lng }),
      confiabilidade: classification.confiabilidade,
      observacaoEstrategica: classification.observacao
    };
  });

  const places: StrategicPlace[] = mappedPlaces
    .filter((place: StrategicPlace | null): place is StrategicPlace => place !== null)
    .sort((a: StrategicPlace, b: StrategicPlace) => {
      const weight = (item: StrategicPlace) => item.categoriaEstrategica === 'Concorrente direto' || item.categoriaEstrategica === 'Concorrente direto de tecnologia' ? 0 : item.categoriaEstrategica === 'Concorrente indireto' || item.categoriaEstrategica === 'Concorrente indireto extracurricular' ? 1 : item.categoriaEstrategica === 'Barreira de acesso ou conveniência' || item.categoriaEstrategica === 'Barreira potencial de agenda' ? 2 : 3;
      return weight(a) - weight(b) || (a.distanciaKm || 0) - (b.distanciaKm || 0);
    })
    .slice(0, 180);

  await prisma.placesCache.upsert({
    where: { cacheKey },
    update: { resultsJson: places as any, cachedAt: new Date(), expiresAt: new Date(Date.now() + TTL_30_DAYS) },
    create: {
      cacheKey,
      cep: input.center.cep,
      domain: input.domain,
      searchType: `market-intelligence:${competitorType}`,
      resultsJson: places as any,
      expiresAt: new Date(Date.now() + TTL_30_DAYS)
    }
  });

  return places;
}
