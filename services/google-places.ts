// Este arquivo conversa com o Google Places.
// Ele procura locais relevantes perto da empresa e transforma a resposta do Google no formato usado pelo relatorio.
// A chave fica no servidor para nao ser exposta no navegador.
import { prisma } from '@/lib/prisma';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { haversineKm } from '@/lib/haversine';
import { assertMonthlyBudget } from '@/services/usage-budget';
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

interface GoogleSearchResult {
  places: GooglePlace[];
  diagnostic?: string;
}

interface StrategicPlacesResult {
  places: StrategicPlace[];
  diagnostics: string[];
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function categoryFromHint(hint: CompetitorTypeConfig['strategicCategoryHint']): CategoriaEstrategica {
  // Cada tipo de busca tem uma dica: direto, indireto, barreira, polo ou parceria.
  // Esta funcao converte essa dica em uma categoria que aparece no relatorio.
  if (hint === 'direto') return 'Concorrente direto';
  if (hint === 'barreira') return 'Barreira de acesso ou conveniência';
  if (hint === 'polo') return 'Polo gerador de público';
  if (hint === 'parceria') return 'Oportunidade de parceria';
  return 'Concorrente indireto';
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
      categoria: 'Barreira de acesso ou conveniência',
      subcategoria: fallback.type,
      observacao: 'O Google Places indica uma instituição que pode influenciar fluxo, conveniência ou competição por atenção na região. Validar impacto antes de ajustar a estratégia.'
    };
  }
  const categoria = categoryFromHint(fallback.strategicCategoryHint);
  return {
    categoria,
    subcategoria: fallback.type,
    observacao: categoria === 'Concorrente direto'
      ? 'Encontrado no Google Places como possível concorrente direto ou oferta muito próxima ao segmento analisado.'
      : categoria === 'Polo gerador de público'
        ? 'Local com potencial de concentração de público e oportunidade para ação local, parceria ou prospecção.'
        : categoria === 'Barreira de acesso ou conveniência'
          ? 'Pode afetar acesso, conveniência, fluxo ou decisão de compra. Validar com clientes reais antes de alterar a oferta.'
          : categoria === 'Oportunidade de parceria'
            ? 'Pode complementar a oferta e gerar parceria, indicação ou ação comercial conjunta.'
            : 'Pode competir indiretamente por atenção, orçamento, conveniência ou ocasião de compra do público-alvo.'
  };
}

function apiKey() {
  // Google Places roda no servidor do Azure, nao no navegador da pessoa.
  // Por isso a chave precisa aceitar chamada server-side; chave com restricao de HTTP referrer da erro 403.
  if (process.env.GOOGLE_MAPS_SERVER_API_KEY) return { key: process.env.GOOGLE_MAPS_SERVER_API_KEY, source: 'GOOGLE_MAPS_SERVER_API_KEY' };
  if (process.env.GOOGLE_PLACES_API_KEY) return { key: process.env.GOOGLE_PLACES_API_KEY, source: 'GOOGLE_PLACES_API_KEY' };
  if (process.env.GOOGLE_MAPS_API_KEY) return { key: process.env.GOOGLE_MAPS_API_KEY, source: 'GOOGLE_MAPS_API_KEY' };
  return { key: '', source: '' };
}

function explainGoogleError(status: number, rawBody: string) {
  // O corpo do Google costuma vir em JSON, mas guardamos como texto porque o erro precisa aparecer no diagnostico.
  // Quando a causa e conhecida, acrescentamos uma orientacao direta para quem vai corrigir no Google Cloud.
  if (status === 403 && rawBody.includes('API_KEY_HTTP_REFERRER_BLOCKED')) {
    return ' A chave usada pelo backend esta bloqueada por HTTP referrer. Crie/use uma chave de servidor para GOOGLE_MAPS_SERVER_API_KEY ou GOOGLE_PLACES_API_KEY, restrinja por API "Places API" e remova restricao de site/referrer nessa chave.';
  }
  if (status === 403 && rawBody.includes('API_KEY_SERVICE_BLOCKED')) {
    return ' A chave nao tem permissao para a Places API. No Google Cloud, habilite a Places API para o projeto e permita essa API nas restricoes da chave.';
  }
  if (status === 403 && rawBody.includes('PERMISSION_DENIED')) {
    return ' O Google negou a chamada. Verifique billing, Places API habilitada e restricoes da chave no Google Cloud.';
  }
  return '';
}

async function googleTextSearch(params: {
  query: string;
  lat: number;
  lng: number;
  radiusM: number;
}): Promise<GoogleSearchResult> {
  // Esta chamada vai para a API nova do Google Places.
  // Pedimos so os campos necessarios para economizar dados e deixar a resposta menor.
  const { key } = apiKey();
  if (!key) return { places: [], diagnostic: 'Google Places não foi chamado porque nenhuma chave foi encontrada no runtime.' };

  try {
    await assertMonthlyBudget('GOOGLE_PLACES');
    const response = await fetchWithTimeout(GOOGLE_TEXT_SEARCH_URL, {
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
    }, 15000);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const diagnostic = `Google Places retornou HTTP ${response.status} para "${params.query}".${explainGoogleError(response.status, text)} ${text.slice(0, 500)}`;
      console.warn(diagnostic);
      return { places: [], diagnostic };
    }

    const json = (await response.json()) as GoogleSearchResponse;
    return { places: Array.isArray(json.places) ? json.places : [] };
  } catch (error) {
    const diagnostic = `Google Places falhou para "${params.query}". ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    console.warn(diagnostic);
    return { places: [], diagnostic };
  }
}

function buildSearchJobs(input: {
  unidade: UnidadeNegocio;
  competitorTypes: CompetitorType[];
  selectedCnaes: CnaeOption[];
  businessActivityDescription?: string;
}): Array<{ query: string; config: CompetitorTypeConfig; competitorType: CompetitorType }> {
  // Um "job" e uma busca que sera enviada ao Google.
  // Criamos buscas combinando tipo de concorrente, escopo escolhido pelo usuario e cidade.
  // Nao fazemos buscas genericas soltas, como "negocios similares RJ", porque isso costuma trazer locais fora da expectativa.
  const configs = getConfigsForCompetitorTypes(input.competitorTypes);
  const municipioUf = `${input.unidade.municipio} ${input.unidade.uf}`.trim();
  const description = String(input.businessActivityDescription || '').trim();
  const selectedTerms = input.selectedCnaes.map((cnae) => cnae.descricao).map((term) => String(term || '').trim()).filter(Boolean);
  const businessTerms = [
    description,
    ...selectedTerms,
    ...(description || selectedTerms.length ? [] : [input.unidade.cnaePrincipalDescricao])
  ].map((term) => String(term || '').trim()).filter(Boolean).slice(0, 6);
  const cnaeTerms = input.selectedCnaes
    .map((cnae) => cnae.descricao)
    .filter(Boolean)
    .slice(0, 4);

  const jobs: Array<{ query: string; config: CompetitorTypeConfig; competitorType: CompetitorType }> = [];
  for (const config of configs) {
    const queries = config.googleQueries.slice(0, 2);
    for (const query of queries) {
      for (const term of businessTerms.slice(0, 3)) {
        jobs.push({ query: `${query} ${term} ${municipioUf}`.trim(), config, competitorType: config.type });
      }
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
  businessActivityDescription?: string;
  radiusKm?: number;
}): Promise<StrategicPlacesResult> {
  // Esta funcao coordena a busca de locais.
  // Primeiro tenta cache; se nao tiver cache e houver chave Google, chama a API e salva o resultado.
  const competitorTypes = input.competitorTypes?.length ? input.competitorTypes : DEFAULT_COMPETITOR_TYPES;
  const activityDescription = String(input.businessActivityDescription || '').trim();
  const selectedCnaes = input.selectedCnaes?.length
    ? input.selectedCnaes
    : activityDescription
      ? []
      : input.unidade.cnaes.slice(0, 1);
  const radiusM = Math.max(1000, Math.min(50000, Math.round((input.radiusKm || 8) * 1000)));
  const activityKey = normalizeText(activityDescription).slice(0, 120);
  const cnaeKey = selectedCnaes.map((cnae) => `${cnae.codigo}-${cnae.descricao}`).sort().join('|');
  const typeKey = [...competitorTypes].sort().join('|');
  const cacheKey = `google:v2:${input.center.cep}:${radiusM}:${typeKey}:${cnaeKey}:${activityKey}`;
  const cached = await prisma.placesCache.findFirst({ where: { cacheKey, expiresAt: { gt: new Date() } } });
  if (cached) {
    const cachedPlaces = cached.resultsJson as unknown as StrategicPlace[];
    if (Array.isArray(cachedPlaces) && cachedPlaces.length > 0) {
      return { places: cachedPlaces, diagnostics: ['Google Places: resultados carregados do cache.'] };
    }
  }

  const { key, source } = apiKey();
  if (!key) {
    return { places: [], diagnostics: ['Google Places não foi executado porque nenhuma variável de chave foi encontrada no runtime. Configure GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_SERVER_API_KEY.'] };
  }

  const maxSearches = Number(process.env.GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS || 24);
  const jobs = buildSearchJobs({ unidade: input.unidade, competitorTypes, selectedCnaes, businessActivityDescription: activityDescription }).slice(0, Math.max(1, maxSearches));
  const ownNames = [input.unidade.razaoSocial, input.unidade.nomeFantasia].filter(Boolean).map((value) => normalizeText(String(value)));
  const seen = new Set<string>();
  const places: StrategicPlace[] = [];
  const scopeForDiagnostics = [
    activityDescription,
    ...selectedCnaes.map((cnae) => cnae.descricao)
  ].filter(Boolean).join(' | ');
  const diagnostics: string[] = [`Google Places: usando ${source}, raio ${Math.round(radiusM / 1000)} km, ${jobs.length} busca(s), escopo: ${scopeForDiagnostics || input.unidade.cnaePrincipalDescricao}.`];

  for (const job of jobs) {
    const search = await googleTextSearch({ query: job.query, lat: input.center.lat, lng: input.center.lng, radiusM });
    if (search.diagnostic && diagnostics.length < 8) diagnostics.push(search.diagnostic);
    const googlePlaces = search.places;
    for (const place of googlePlaces) {
      const nome = place.displayName?.text || 'Local sem nome';
      const normalizedName = normalizeText(nome);
      if (ownNames.some((own) => own && normalizedName.includes(own))) continue;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const distanciaKm = Number(haversineKm(input.center, { lat, lng }).toFixed(2));
      if (distanciaKm > radiusM / 1000) continue;
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
        distanciaKm,
        rating,
        userRatingCount,
        confiabilidade: rating && userRatingCount && userRatingCount >= 5 ? 'Alta' : 'Média',
        observacaoEstrategica: `${classification.observacao}${rating ? ` Avaliação Google: ${rating.toFixed(1)} (${userRatingCount || 0} avaliações).` : ' Avaliação Google não disponível.'}`
      });
    }
  }

  const sorted = places
    .sort((a, b) => {
      const weight = (item: StrategicPlace) => item.categoriaEstrategica === 'Concorrente direto' || item.categoriaEstrategica === 'Concorrente direto de tecnologia' ? 0 : item.categoriaEstrategica === 'Concorrente indireto' || item.categoriaEstrategica === 'Concorrente indireto extracurricular' ? 1 : item.categoriaEstrategica === 'Barreira de acesso ou conveniência' || item.categoriaEstrategica === 'Barreira potencial de agenda' ? 2 : 3;
      return weight(a) - weight(b) || (b.rating || 0) - (a.rating || 0) || (a.distanciaKm || 0) - (b.distanciaKm || 0);
    })
    .slice(0, 200);

  if (!sorted.length) {
    diagnostics.push('Google Places executou, mas não retornou locais aproveitáveis para os termos, raio e coordenadas desta análise. Nenhum resultado vazio foi gravado no cache.');
    return { places: [], diagnostics };
  }

  await prisma.placesCache.upsert({
    where: { cacheKey },
    update: { resultsJson: sorted as any, cachedAt: new Date(), expiresAt: new Date(Date.now() + TTL_30_DAYS) },
    create: {
      cacheKey,
      cep: input.center.cep,
      domain: scopeForDiagnostics || input.unidade.cnaePrincipalDescricao,
      searchType: `google-places:${typeKey}`,
      resultsJson: sorted as any,
      expiresAt: new Date(Date.now() + TTL_30_DAYS)
    }
  });

  diagnostics.push(`Google Places retornou ${sorted.length} local(is) relevante(s) depois de filtros de raio, duplicidade e nome da própria empresa.`);
  return { places: sorted, diagnostics };
}





