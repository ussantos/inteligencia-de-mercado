import { prisma } from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';
import {
  DEFAULT_COMPETITOR_TYPES,
  getActiveCompetitorTypes,
  getConfigsForCompetitorTypes,
  type CompetitorType,
  type CompetitorTypeConfig
} from '@/lib/competitor-types';
import type { CategoriaEstrategica, CnaeOption, StrategicPlace, UnidadeNegocio } from '@/lib/types';

const TTL_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const GOOGLE_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function categoryFromHint(hint: CompetitorTypeConfig['strategicCategoryHint']): CategoriaEstrategica {
  if (hint === 'direto') return 'Concorrente direto de tecnologia';
  if (hint === 'barreira') return 'Barreira potencial de agenda';
  if (hint === 'polo') return 'Polo gerador de público';
  return 'Concorrente indireto extracurricular';
}

function extractBairro(address?: string) {
  if (!address) return undefined;
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const likely = parts.find((part) => /barra|recreio|jacarepaguá|jacarepagua|vargem|taquara|tijuca|ipanema|copacabana|botafogo|flamengo|méier|meier|madureira/i.test(part));
  return likely || parts[1] || undefined;
}

function classifyByGoogleTypes(types: string[] | undefined, fallback: CompetitorTypeConfig): { categoria: CategoriaEstrategica; subcategoria: string; observacao: string } {
  const joined = (types || []).join(' ');
  if (/school|primary_school|secondary_school|preschool/i.test(joined) && fallback.strategicCategoryHint === 'barreira') {
    return {
      categoria: 'Barreira potencial de agenda',
      subcategoria: fallback.type,
      observacao: 'O Google Places indica uma escola ou instituição escolar. Pode reduzir disponibilidade da criança se houver contraturno ou horário integral; validar no atendimento.'
    };
  }
  const categoria = categoryFromHint(fallback.strategicCategoryHint);
  return {
    categoria,
    subcategoria: fallback.type,
    observacao: categoria === 'Concorrente direto de tecnologia'
      ? 'Encontrado no Google Places como possÃ­vel oferta concorrente ou substituta em tecnologia, programação, robótica, games ou maker.'
      : categoria === 'Polo gerador de público'
        ? 'Local com potencial de concentração de famÃ­lias e oportunidade para ação local, parceria ou evento.'
        : categoria === 'Barreira potencial de agenda'
          ? 'Pode competir com a agenda da criança ou indicar rotina escolar intensa. Validar com leads reais antes de alterar a oferta.'
          : 'Pode competir pelo tempo, atenção e orçamento familiar destinado a atividades extracurriculares.'
  };
}

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

async function googleTextSearch(params: {
  query: string;
  lat: number;
  lng: number;
  radiusM: number;
}): Promise<GooglePlace[]> {
  const key = apiKey();
  if (!key) return [];

  const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.websiteUri',
        'places.nationalPhoneNumber',
        'places.regularOpeningHours',
        'places.types'
      ].join(',')
    },
    body: JSON.stringify({
      textQuery: params.query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: params.radiusM
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.warn(`Google Places retornou HTTP ${response.status} para "${params.query}". ${text}`);
    return [];
  }

  const json = (await response.json()) as GoogleSearchResponse;
  return Array.isArray(json.places) ? json.places : [];
}

function buildSearchJobs(input: {
  unidade: UnidadeNegocio;
  competitorTypes: CompetitorType[];
  selectedCnaes: CnaeOption[];
}): Array<{ query: string; config: CompetitorTypeConfig; competitorType: CompetitorType }> {
  const configs = getConfigsForCompetitorTypes(input.competitorTypes);
  const municipioUf = `${input.unidade.municipio} ${input.unidade.uf}`.trim();
  const cnaeTerms = input.selectedCnaes
    .map((cnae) => cnae.descricao)
    .filter(Boolean)
    .slice(0, 4);

  const jobs: Array<{ query: string; config: CompetitorTypeConfig; competitorType: CompetitorType }> = [];
  for (const config of configs) {
    const queries = config.googleQueries.slice(0, 2);
    for (const query of queries) {
      jobs.push({ query: `${query} ${municipioUf}`.trim(), config, competitorType: config.type });
    }
  }

  for (const cnae of cnaeTerms) {
    const directConfig = configs.find((config) => config.strategicCategoryHint === 'direto') || configs[0];
    if (directConfig) {
      jobs.push({ query: `${cnae} ${municipioUf}`.trim(), config: directConfig, competitorType: directConfig.type });
    }
  }

  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = normalizeText(job.query);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getStrategicPlaces(input: {
  center: { lat: number; lng: number; cep: string };
  unidade: UnidadeNegocio;
  competitorTypes?: CompetitorType[];
  selectedCnaes?: CnaeOption[];
  radiusKm?: number;
}): Promise<StrategicPlace[]> {
  const competitorTypes = input.competitorTypes?.length ? input.competitorTypes : DEFAULT_COMPETITOR_TYPES;
  const selectedCnaes = input.selectedCnaes?.length ? input.selectedCnaes : input.unidade.cnaes;
  const radiusM = Math.max(1000, Math.min(50000, Math.round((input.radiusKm || 8) * 1000)));
  const cnaeKey = selectedCnaes.map((cnae) => `${cnae.codigo}-${cnae.descricao}`).sort().join('|');
  const typeKey = [...competitorTypes].sort().join('|');
  const cacheKey = `google:${input.center.cep}:${radiusM}:${typeKey}:${cnaeKey}`;
  const cached = await prisma.placesCache.findFirst({ where: { cacheKey, expiresAt: { gt: new Date() } } });
  if (cached) return cached.resultsJson as unknown as StrategicPlace[];

  const key = apiKey();
  if (!key) {
    await prisma.placesCache.upsert({
      where: { cacheKey },
      update: { resultsJson: [], cachedAt: new Date(), expiresAt: new Date(Date.now() + TTL_30_DAYS) },
      create: { cacheKey, cep: input.center.cep, domain: selectedCnaes.map((cnae) => cnae.descricao).join(', '), searchType: 'google-places-sem-chave', resultsJson: [], expiresAt: new Date(Date.now() + TTL_30_DAYS) }
    });
    return [];
  }

  const maxSearches = Number(process.env.GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS || 24);
  const jobs = buildSearchJobs({ unidade: input.unidade, competitorTypes, selectedCnaes }).slice(0, Math.max(1, maxSearches));
  const ownNames = [input.unidade.razaoSocial, input.unidade.nomeFantasia].filter(Boolean).map((value) => normalizeText(String(value)));
  const seen = new Set<string>();
  const places: StrategicPlace[] = [];

  for (const job of jobs) {
    const googlePlaces = await googleTextSearch({ query: job.query, lat: input.center.lat, lng: input.center.lng, radiusM });
    for (const place of googlePlaces) {
      const nome = place.displayName?.text || 'Local sem nome';
      const normalizedName = normalizeText(nome);
      if (ownNames.some((own) => own && normalizedName.includes(own))) continue;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const dedupKey = place.id || `${normalizedName}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const classification = classifyByGoogleTypes(place.types, job.config);
      const rating = typeof place.rating === 'number' ? place.rating : null;
      const userRatingCount = typeof place.userRatingCount === 'number' ? place.userRatingCount : null;
      places.push({
        nome,
        categoriaEstrategica: classification.categoria,
        subcategoria: classification.subcategoria,
        competitorType: job.competitorType,
        fonte: 'Google Places',
        googlePlaceId: place.id,
        googleTypes: place.types || [],
        lat,
        lng,
        endereco: place.formattedAddress,
        bairro: extractBairro(place.formattedAddress),
        website: place.websiteUri,
        telefone: place.nationalPhoneNumber,
        horarioFuncionamento: place.regularOpeningHours?.weekdayDescriptions?.join(' · '),
        distanciaKm: Number(haversineKm(input.center, { lat, lng }).toFixed(2)),
        rating,
        userRatingCount,
        confiabilidade: rating && userRatingCount && userRatingCount >= 5 ? 'Alta' : 'Média',
        observacaoEstrategica: `${classification.observacao}${rating ? ` Avaliação Google: ${rating.toFixed(1)} (${userRatingCount || 0} avaliações).` : ' Avaliação Google não disponÃ­vel.'}`
      });
    }
  }

  const sorted = places
    .sort((a, b) => {
      const weight = (item: StrategicPlace) => item.categoriaEstrategica === 'Concorrente direto de tecnologia' ? 0 : item.categoriaEstrategica === 'Concorrente indireto extracurricular' ? 1 : item.categoriaEstrategica === 'Barreira potencial de agenda' ? 2 : 3;
      return weight(a) - weight(b) || (b.rating || 0) - (a.rating || 0) || (a.distanciaKm || 0) - (b.distanciaKm || 0);
    })
    .slice(0, 200);

  await prisma.placesCache.upsert({
    where: { cacheKey },
    update: { resultsJson: sorted as any, cachedAt: new Date(), expiresAt: new Date(Date.now() + TTL_30_DAYS) },
    create: {
      cacheKey,
      cep: input.center.cep,
      domain: selectedCnaes.map((cnae) => cnae.descricao).join(', '),
      searchType: `google-places:${typeKey}`,
      resultsJson: sorted as any,
      expiresAt: new Date(Date.now() + TTL_30_DAYS)
    }
  });

  return sorted;
}





