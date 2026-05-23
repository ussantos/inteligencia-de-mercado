import { prisma } from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';

export async function getDistance(origin: { cep: string; lat: number; lng: number }, dest: { cep: string; lat: number; lng: number }) {
  const cached = await prisma.distanceCache.findUnique({
    where: { originCep_destCep: { originCep: origin.cep, destCep: dest.cep } }
  });

  if (cached) {
    return {
      linhaRetaKm: haversineKm(origin, dest),
      carroKm: cached.distanceM / 1000,
      tempoMin: cached.durationS ? cached.durationS / 60 : null,
      source: cached.source
    };
  }

  const linhaRetaKm = haversineKm(origin, dest);
  const orsKey = process.env.ORS_API_KEY;

  if (!orsKey) {
    await prisma.distanceCache.create({
      data: {
        originCep: origin.cep,
        destCep: dest.cep,
        distanceM: linhaRetaKm * 1000,
        durationS: null,
        source: 'Haversine'
      }
    });
    return { linhaRetaKm, carroKm: null, tempoMin: null, source: 'Haversine' };
  }

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
      method: 'POST',
      headers: {
        Authorization: orsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locations: [
          [origin.lng, origin.lat],
          [dest.lng, dest.lat]
        ],
        metrics: ['distance', 'duration']
      })
    });

    if (!response.ok) throw new Error('ORS indisponível');
    const json = await response.json();
    const distanceM = Number(json.distances?.[0]?.[1]);
    const durationS = Number(json.durations?.[0]?.[1]);

    if (!Number.isFinite(distanceM)) throw new Error('ORS retornou distância inválida');

    await prisma.distanceCache.create({
      data: {
        originCep: origin.cep,
        destCep: dest.cep,
        distanceM,
        durationS: Number.isFinite(durationS) ? durationS : null,
        source: 'OpenRouteService'
      }
    });

    return {
      linhaRetaKm,
      carroKm: distanceM / 1000,
      tempoMin: Number.isFinite(durationS) ? durationS / 60 : null,
      source: 'OpenRouteService'
    };
  } catch {
    await prisma.distanceCache.create({
      data: {
        originCep: origin.cep,
        destCep: dest.cep,
        distanceM: linhaRetaKm * 1000,
        durationS: null,
        source: 'Haversine'
      }
    });
    return { linhaRetaKm, carroKm: null, tempoMin: null, source: 'Haversine' };
  }
}
