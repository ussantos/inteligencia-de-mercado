'use client';

// Este componente desenha o mapa do relatorio usando Google Maps.
// A chave publica do navegador serve apenas para mostrar o mapa; a busca de concorrentes continua no servidor.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResult, StrategicPlace } from '@/lib/types';
import { formatCep, formatKm } from '@/lib/utils';

type GoogleWindow = Window & {
  google?: any;
  __googleMapsPromise?: Promise<void>;
};

const PLACE_COLORS: Record<string, string> = {
  direto: '#0f172a',
  indireto: '#475569',
  barreira: '#f97316',
  polo: '#7c3aed',
  parceria: '#16a34a',
  outro: '#0891b2'
};

function getGoogleWindow() {
  return window as GoogleWindow;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isValidCoord(lat: unknown, lng: unknown) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

function loadGoogleMaps(apiKey: string) {
  const googleWindow = getGoogleWindow();
  if (googleWindow.google?.maps) return Promise.resolve();
  if (!googleWindow.__googleMapsPromise) {
    googleWindow.__googleMapsPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=pt-BR&region=BR`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'));
      document.head.appendChild(script);
    });
  }
  return googleWindow.__googleMapsPromise;
}

function strategicColor(place: StrategicPlace) {
  const category = place.categoriaEstrategica.toLowerCase();
  if (category.includes('barreira')) return PLACE_COLORS.barreira;
  if (category.includes('parceria')) return PLACE_COLORS.parceria;
  if (category.includes('polo')) return PLACE_COLORS.polo;
  if (category.includes('indireto')) return PLACE_COLORS.indireto;
  if (category.includes('direto')) return PLACE_COLORS.direto;
  return PLACE_COLORS.outro;
}

function markerSymbol(google: any, color: string, scale = 8) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale
  };
}

function makeInfoWindow(google: any, content: string) {
  return new google.maps.InfoWindow({ content, maxWidth: 340 });
}

function clearOverlays(overlays: Array<{ setMap: (map: any) => void }>) {
  overlays.forEach((overlay) => overlay.setMap(null));
}

export function MarketMap({ result }: { result: AnalysisResult }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY;
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: any) => void }>>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(apiKey ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCompany, setShowCompany] = useState(true);
  const [showCustomers, setShowCustomers] = useState(true);
  const [showPlaces, setShowPlaces] = useState(true);

  const center = useMemo(() => {
    if (!isValidCoord(result.unidadeGeo.lat, result.unidadeGeo.lng)) return null;
    return { lat: result.unidadeGeo.lat, lng: result.unidadeGeo.lng };
  }, [result.unidadeGeo.lat, result.unidadeGeo.lng]);

  const validPoints = useMemo(() => result.points.filter((point) => isValidCoord(point.lat, point.lng)), [result.points]);
  const validPlaces = useMemo(() => result.strategicPlaces.filter((place) => isValidCoord(place.lat, place.lng)), [result.strategicPlaces]);

  useEffect(() => {
    if (!apiKey || !center || !mapElementRef.current) {
      setStatus('error');
      setErrorMessage('Configure NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY para exibir o Google Maps no navegador.');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapElementRef.current) return;
        const google = getGoogleWindow().google;
        mapRef.current = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 12,
          clickableIcons: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },
            { featureType: 'transit', stylers: [{ visibility: 'simplified' }] }
          ]
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Não foi possível carregar o Google Maps. Verifique a chave pública, a Maps JavaScript API e as restrições de HTTP referrer.');
        }
      });

    return () => {
      cancelled = true;
      clearOverlays(overlaysRef.current);
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, [apiKey, center]);

  useEffect(() => {
    const google = getGoogleWindow().google;
    const map = mapRef.current;
    if (status !== 'ready' || !google?.maps || !map || !center) return;

    clearOverlays(overlaysRef.current);
    overlaysRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const infoWindow = makeInfoWindow(google, '');
    let boundsCount = 1;
    bounds.extend(center);

    if (showCompany) {
      const marker = new google.maps.Marker({
        map,
        position: center,
        title: 'Sua empresa',
        label: { text: 'E', color: '#ffffff', fontWeight: '700' },
        icon: markerSymbol(google, '#2563eb', 11)
      });
      marker.addListener('click', () => {
        infoWindow.setContent(
          `<strong>Sua empresa</strong><br>${escapeHtml(result.unidade.nomeFantasia || result.unidade.razaoSocial)}<br>${escapeHtml(result.unidadeGeo.endereco)}`
        );
        infoWindow.open(map, marker);
      });
      overlaysRef.current.push(marker);
    }

    if (showCustomers) {
      validPoints.forEach((point) => {
        const position = { lat: point.lat, lng: point.lng };
        bounds.extend(position);
        boundsCount += 1;
        const marker = new google.maps.Marker({
          map,
          position,
          title: `CEP ${formatCep(point.cep)}`,
          icon: markerSymbol(google, '#2563eb', 6)
        });
        marker.addListener('click', () => {
          infoWindow.setContent(
            `<strong>CEP ${escapeHtml(formatCep(point.cep))}</strong><br>${escapeHtml(point.bairro)}, ${escapeHtml(point.cidade)}/${escapeHtml(point.uf)}<br>Distancia: ${escapeHtml(formatKm(point.distanciaLinhaRetaKm))}`
          );
          infoWindow.open(map, marker);
        });
        overlaysRef.current.push(marker);
      });
    }

    if (showPlaces) {
      validPlaces.slice(0, 120).forEach((place) => {
        const position = { lat: place.lat, lng: place.lng };
        const color = strategicColor(place);
        bounds.extend(position);
        boundsCount += 1;
        const marker = new google.maps.Marker({
          map,
          position,
          title: place.nome,
          label: place.categoriaEstrategica.toLowerCase().includes('barreira') ? { text: '!', color: '#ffffff', fontWeight: '700' } : undefined,
          icon: markerSymbol(google, color, place.categoriaEstrategica.toLowerCase().includes('barreira') ? 9 : 7)
        });
        marker.addListener('click', () => {
          const rating = place.rating ? `<br>Avaliação: ${escapeHtml(place.rating.toFixed(1))} (${escapeHtml(place.userRatingCount || 0)} avaliações)` : '';
          const website = place.website ? `<br><a href="${escapeHtml(place.website)}" target="_blank" rel="noreferrer">Site do local</a>` : '';
          infoWindow.setContent(
            `<strong>${escapeHtml(place.nome)}</strong><br>${escapeHtml(place.categoriaEstrategica)}<br>${escapeHtml(place.subcategoria)}${rating}<br>Distancia: ${escapeHtml(formatKm(place.distanciaKm))}<br>Fonte: ${escapeHtml(place.fonte)}<br>${escapeHtml(place.observacaoEstrategica)}${website}`
          );
          infoWindow.open(map, marker);
        });
        overlaysRef.current.push(marker);
      });
    }

    if (boundsCount > 1) {
      map.fitBounds(bounds, 48);
    } else {
      map.setCenter(center);
      map.setZoom(12);
    }
  }, [center, result.unidade.nomeFantasia, result.unidade.razaoSocial, result.unidadeGeo.endereco, showCompany, showCustomers, showPlaces, status, validPlaces, validPoints]);

  if (!center) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
        Não foi possível desenhar o mapa porque a coordenada da empresa não foi encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <LayerToggle checked={showCompany} color="#2563eb" label="Empresa" onChange={setShowCompany} />
        <LayerToggle checked={showCustomers} color="#2563eb" label="CEPs/clientes" onChange={setShowCustomers} />
        <LayerToggle checked={showPlaces} color="#0f172a" label="Concorrentes e locais" onChange={setShowPlaces} />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200">
        <div ref={mapElementRef} className="google-map-canvas" />
        {status !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 p-6 text-center text-sm text-slate-600">
            {status === 'loading' ? 'Carregando Google Maps...' : errorMessage}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <LegendDot color="#0f172a" label="Concorrente direto" />
        <LegendDot color="#475569" label="Concorrente indireto" />
        <LegendDot color="#f97316" label="Barreira" />
        <LegendDot color="#7c3aed" label="Polo de público" />
        <LegendDot color="#16a34a" label="Parceria" />
      </div>
    </div>
  );
}

function LayerToggle({ checked, color, label, onChange }: { checked: boolean; color: string; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm">
      <input className="h-4 w-4 accent-orange-500" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </label>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
