// Este arquivo transforma CEP em latitude e longitude.
// Primeiro pegamos o endereco pelo ViaCEP, depois usamos LocationIQ ou Nominatim para achar o ponto no mapa.
import { prisma } from '@/lib/prisma';
import { normalizeCep } from '@/lib/cep';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { getViaCep } from '@/services/viacep';
import { assertMonthlyBudget } from '@/services/usage-budget';
import { slugify } from '@/lib/utils';

export interface GeoResult {
  cep: string;
  lat: number;
  lng: number;
  address: string;
  bairro: string;
  cidade: string;
  uf: string;
  source: string;
}

const NOMINATIM_DELAY_MS = 1100;
let lastNominatimCall = 0;

async function waitNominatimSlot() {
  // Nominatim pede para nao receber muitas chamadas seguidas.
  // Este pequeno atraso ajuda a respeitar o servico gratuito.
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < NOMINATIM_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_DELAY_MS - elapsed));
  }
  lastNominatimCall = Date.now();
}

function buildAddress(parts: { logradouro?: string; bairro?: string; localidade?: string; uf?: string; cep?: string }) {
  return [parts.logradouro, parts.bairro, parts.localidade, parts.uf, parts.cep, 'Brasil'].filter(Boolean).join(', ');
}

async function geocodeTextAddress(address: string) {
  const locationIqKey = process.env.LOCATIONIQ_API_KEY;
  const locationIqUrl = locationIqKey
    ? `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(locationIqKey)}&q=${encodeURIComponent(address)}&format=json&limit=1`
    : null;

  let lat: number | null = null;
  let lng: number | null = null;
  let source = 'Nominatim';

  if (locationIqUrl) {
    try {
      await assertMonthlyBudget('LOCATIONIQ');
      const response = await fetchWithTimeout(locationIqUrl, {}, 10000);
      if (response.ok) {
        const json = (await response.json()) as Array<{ lat: string; lon: string }>;
        if (json[0]) {
          lat = Number(json[0].lat);
          lng = Number(json[0].lon);
          source = 'LocationIQ';
        }
      }
    } catch {
      // fallback abaixo
    }
  }

  if (lat == null || lng == null) {
    await waitNominatimSlot();
    try {
      await assertMonthlyBudget('NOMINATIM');
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=br`;
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'inteligencia-de-mercado/1.0' }
      }, 12000);
      if (response.ok) {
        const json = (await response.json()) as Array<{ lat: string; lon: string }>;
        if (json[0]) {
          lat = Number(json[0].lat);
          lng = Number(json[0].lon);
          source = 'Nominatim';
        }
      }
    } catch {
      // Se o geocodificador publico falhar, retornamos null.
    }
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng, source };
}

export async function geocodeAddress(input: {
  address: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}): Promise<GeoResult | null> {
  // Usado quando o usuario ainda nao tem CNPJ.
  // Recebe um endereco digitado e tenta achar coordenadas para iniciar a analise regional.
  const address = [input.address, input.bairro, input.cidade, input.uf, 'Brasil'].filter(Boolean).join(', ');
  if (address.replace(/Brasil|,/gi, '').trim().length < 5) return null;

  const geocoded = await geocodeTextAddress(address);
  if (!geocoded) return null;

  const normalizedCep = normalizeCep(input.cep || '');
  return {
    cep: normalizedCep || `manual-${slugify(address).slice(0, 64)}`,
    lat: geocoded.lat,
    lng: geocoded.lng,
    address,
    bairro: input.bairro || '',
    cidade: input.cidade || '',
    uf: input.uf || '',
    source: geocoded.source
  };
}

export async function geocodeCep(cepInput: string): Promise<GeoResult | null> {
  // Esta funcao recebe um CEP, limpa o texto, procura no cache e, se precisar, chama APIs externas.
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return null;

  const cached = await prisma.cepGeocodeCache.findUnique({ where: { cep } });
  if (cached) {
    return {
      cep,
      lat: cached.lat,
      lng: cached.lng,
      address: cached.address,
      bairro: cached.bairro || '',
      cidade: cached.cidade || '',
      uf: cached.uf || '',
      source: cached.source
    };
  }

  const viaCep = await getViaCep(cep);
  if (!viaCep) return null;

  const address = buildAddress(viaCep);
  const geocoded = await geocodeTextAddress(address);
  if (!geocoded) return null;

  await prisma.cepGeocodeCache.create({
    data: {
      cep,
      lat: geocoded.lat,
      lng: geocoded.lng,
      address,
      bairro: viaCep.bairro,
      cidade: viaCep.localidade,
      uf: viaCep.uf,
      source: geocoded.source
    }
  });

  return {
    cep,
    lat: geocoded.lat,
    lng: geocoded.lng,
    address,
    bairro: viaCep.bairro,
    cidade: viaCep.localidade,
    uf: viaCep.uf,
    source: geocoded.source
  };
}
