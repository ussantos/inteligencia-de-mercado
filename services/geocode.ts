import { prisma } from '@/lib/prisma';
import { normalizeCep } from '@/lib/cep';
import { getViaCep } from '@/services/viacep';

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

export async function geocodeCep(cepInput: string): Promise<GeoResult | null> {
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
  const locationIqKey = process.env.LOCATIONIQ_API_KEY;
  const locationIqUrl = locationIqKey
    ? `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(locationIqKey)}&q=${encodeURIComponent(address)}&format=json&limit=1`
    : null;

  let lat: number | null = null;
  let lng: number | null = null;
  let source = 'Nominatim';

  if (locationIqUrl) {
    try {
      const response = await fetch(locationIqUrl);
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
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=br`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'inteligencia-myrobot/1.0 contato@myrobotbarra.com.br' }
    });
    if (response.ok) {
      const json = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (json[0]) {
        lat = Number(json[0].lat);
        lng = Number(json[0].lon);
        source = 'Nominatim';
      }
    }
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  await prisma.cepGeocodeCache.create({
    data: {
      cep,
      lat,
      lng,
      address,
      bairro: viaCep.bairro,
      cidade: viaCep.localidade,
      uf: viaCep.uf,
      source
    }
  });

  return {
    cep,
    lat,
    lng,
    address,
    bairro: viaCep.bairro,
    cidade: viaCep.localidade,
    uf: viaCep.uf,
    source
  };
}
