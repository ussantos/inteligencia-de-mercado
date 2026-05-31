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
const PUBLIC_EMAIL_DOMAINS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'uol.com.br', 'bol.com.br']);
const LEGAL_NAME_TOKENS = new Set(['ltda', 'limitada', 'eireli', 'mei', 'epp', 'me', 'sa', 's', 'a', 'de', 'da', 'do', 'das', 'dos', 'e']);
const STREET_NAME_TOKENS = new Set(['rua', 'avenida', 'av', 'r', 'estrada', 'rodovia', 'travessa', 'alameda', 'praca', 'praça', 'largo', 'numero', 'n']);
const BR_SECOND_LEVEL_DOMAINS = new Set(['com', 'edu', 'org', 'net', 'gov', 'ind', 'inf']);

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

function normalizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeSearchText(value?: string | null) {
  return normalizeText(String(value || '')).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(value?: string | null, ignored = LEGAL_NAME_TOKENS) {
  return new Set(normalizeSearchText(value).split(' ').filter((token) => token.length >= 3 && !ignored.has(token)));
}

function samePhone(a?: string | null, b?: string | null) {
  const left = normalizeDigits(a);
  const right = normalizeDigits(b);
  if (left.length < 8 || right.length < 8) return false;
  return left.slice(-8) === right.slice(-8);
}

function relevantDomain(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return PUBLIC_EMAIL_DOMAINS.has(host) ? '' : host;
  } catch {
    return '';
  }
}

function emailDomain(value?: string | null) {
  const domain = String(value || '').split('@')[1]?.trim().toLowerCase() || '';
  return domain && !PUBLIC_EMAIL_DOMAINS.has(domain) ? domain : '';
}

function rootDomain(domain: string) {
  const parts = domain.split('.').filter(Boolean);
  if (parts.length <= 2) return domain;
  if (parts.at(-1) === 'br' && BR_SECOND_LEVEL_DOMAINS.has(parts.at(-2) || '') && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function sameDomain(a?: string | null, b?: string | null) {
  const left = relevantDomain(a);
  const right = relevantDomain(b);
  if (!left || !right) return false;
  return left === right || rootDomain(left) === rootDomain(right);
}

function bestNameMatch(placeName: string, unidade: UnidadeNegocio) {
  const placeCompact = normalizeSearchText(placeName);
  const placeTokens = tokenSet(placeName);
  const candidates = [unidade.nomeFantasia, unidade.razaoSocial].filter(Boolean).map(String);
  let best = { matches: 0, score: 0, strongContains: false };

  for (const candidate of candidates) {
    const candidateCompact = normalizeSearchText(candidate);
    const candidateTokens = tokenSet(candidate);
    const matches = [...candidateTokens].filter((token) => placeTokens.has(token)).length;
    const denominator = Math.max(1, Math.min(candidateTokens.size, placeTokens.size));
    const score = matches / denominator;
    const strongContains = candidateCompact.length >= 7
      && placeCompact.length >= 7
      && (placeCompact.includes(candidateCompact) || candidateCompact.includes(placeCompact));
    if (score > best.score || strongContains) {
      best = { matches, score, strongContains };
    }
  }

  return best;
}

function addressMatchesOwnCompany(unidade: UnidadeNegocio, formattedAddress?: string, distanciaKm?: number) {
  const addressText = normalizeSearchText(formattedAddress);
  if (!addressText) return false;

  const number = normalizeDigits(unidade.numero);
  const numberWithoutLeadingZeros = number ? String(Number(number)) : '';
  const numberVariants = [...new Set([number, numberWithoutLeadingZeros].filter((item) => item && item !== 'NaN'))];
  const hasNumber = numberVariants.some((item) => new RegExp(`\\b${item}\\b`).test(addressText));
  const streetTokens = [...tokenSet(unidade.logradouro, STREET_NAME_TOKENS)];
  const streetMatch = streetTokens.length > 0 && streetTokens.some((token) => addressText.includes(token));
  const bairroTokens = [...tokenSet(unidade.bairro)];
  const bairroMatch = bairroTokens.length > 0 && bairroTokens.some((token) => addressText.includes(token));
  const near = typeof distanciaKm === 'number' && distanciaKm <= 0.18;

  return Boolean((hasNumber && streetMatch && bairroMatch) || (near && hasNumber && (streetMatch || bairroMatch)));
}

async function websiteMentionsCnpj(websiteUri: string | undefined, cnpj: string) {
  if (!websiteUri || cnpj.length !== 14) return false;
  try {
    const response = await fetchWithTimeout(websiteUri, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketIntelligenceBot/1.0)' },
      redirect: 'follow'
    }, 5000);
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|text\/plain|application\/xhtml/i.test(contentType)) return false;
    const text = (await response.text()).slice(0, 250000);
    return normalizeDigits(text).includes(cnpj);
  } catch {
    return false;
  }
}

async function ownCompanyMatchReason(input: {
  unidade: UnidadeNegocio;
  place: GooglePlace;
  nome: string;
  distanciaKm: number;
  allowWebsiteCheck: boolean;
}) {
  // A Places API nao retorna CNPJ. Por isso removemos a propria empresa usando sinais fortes:
  // telefone, endereco/coordenada, dominio do site/e-mail, nome publico e, quando possivel, CNPJ no site retornado pelo Google.
  const { unidade, place, nome, distanciaKm, allowWebsiteCheck } = input;
  if (samePhone(unidade.telefone, place.nationalPhoneNumber)) return 'telefone igual ao CNPJ';

  const nameMatch = bestNameMatch(nome, unidade);
  const addressMatch = addressMatchesOwnCompany(unidade, place.formattedAddress, distanciaKm);
  const unitEmailDomain = emailDomain(unidade.email);
  const domainMatch = unitEmailDomain ? sameDomain(place.websiteUri, unitEmailDomain) : false;
  const likelyOwnCandidate = addressMatch || domainMatch || nameMatch.strongContains || (nameMatch.score >= 0.7 && nameMatch.matches >= 2);

  if (allowWebsiteCheck && likelyOwnCandidate && await websiteMentionsCnpj(place.websiteUri, normalizeDigits(unidade.cnpj))) {
    return 'site retornado pelo Google contem o mesmo CNPJ';
  }
  if (addressMatch && (nameMatch.score >= 0.45 || nameMatch.strongContains)) return 'nome e endereco conferem com a empresa analisada';
  if (addressMatch && distanciaKm <= 0.08) return 'endereco e coordenadas conferem com a empresa analisada';
  if (domainMatch && (nameMatch.score >= 0.45 || addressMatch)) return 'dominio do site/e-mail confere com a empresa analisada';
  if ((nameMatch.strongContains || (nameMatch.score >= 0.8 && nameMatch.matches >= 2)) && distanciaKm <= 0.15) return 'nome publico e coordenadas conferem com a empresa analisada';

  return '';
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
  const cacheKey = `google:v3:${input.center.cep}:${radiusM}:${typeKey}:${cnaeKey}:${activityKey}`;
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
  let skippedOwnCompany = 0;
  let ownWebsiteChecks = 0;
  const ownCompanyReasons = new Set<string>();
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
      if (ownNames.some((own) => own && own.length >= 8 && normalizedName.includes(own))) {
        skippedOwnCompany += 1;
        ownCompanyReasons.add('nome igual ao cadastro do CNPJ');
        continue;
      }
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const distanciaKm = Number(haversineKm(input.center, { lat, lng }).toFixed(2));
      if (distanciaKm > radiusM / 1000) continue;
      const lightweightNameMatch = bestNameMatch(nome, input.unidade);
      const lightweightAddressMatch = addressMatchesOwnCompany(input.unidade, place.formattedAddress, distanciaKm);
      const shouldCheckWebsite = Boolean(place.websiteUri)
        && ownWebsiteChecks < 3
        && (lightweightAddressMatch || lightweightNameMatch.strongContains || (lightweightNameMatch.score >= 0.55 && lightweightNameMatch.matches >= 2));
      if (shouldCheckWebsite) ownWebsiteChecks += 1;
      const ownReason = await ownCompanyMatchReason({
        unidade: input.unidade,
        place,
        nome,
        distanciaKm,
        allowWebsiteCheck: shouldCheckWebsite
      });
      if (ownReason) {
        skippedOwnCompany += 1;
        ownCompanyReasons.add(ownReason);
        continue;
      }
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
    if (skippedOwnCompany) {
      diagnostics.push(`Google Places: ${skippedOwnCompany} resultado(s) ignorado(s) por parecerem ser a própria empresa analisada (${[...ownCompanyReasons].slice(0, 3).join('; ')}).`);
    }
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

  if (skippedOwnCompany) {
    diagnostics.push(`Google Places: ${skippedOwnCompany} resultado(s) ignorado(s) por parecerem ser a própria empresa analisada (${[...ownCompanyReasons].slice(0, 3).join('; ')}).`);
  }
  diagnostics.push(`Google Places retornou ${sorted.length} local(is) relevante(s) depois de filtros de raio, duplicidade e identificação da própria empresa.`);
  return { places: sorted, diagnostics };
}





