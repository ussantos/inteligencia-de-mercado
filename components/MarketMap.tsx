'use client';

// Este componente desenha o mapa.
// Ele coloca marcadores para a empresa, clientes e concorrentes, usando Leaflet e tiles do OpenStreetMap.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { AnalysisResult } from '@/lib/types';
import { formatCep, formatKm } from '@/lib/utils';

let leafletPluginsLoaded = false;

async function ensureLeafletPluginsLoaded() {
  // Alguns plugins do Leaflet so existem no navegador.
  // Por isso carregamos esses plugins apenas depois que a pagina ja esta rodando no computador da pessoa.
  if (leafletPluginsLoaded) return;
  if (typeof window === 'undefined') return;
  (window as typeof window & { L?: typeof L }).L = L;
  await import('leaflet.heat');
  await import('leaflet.markercluster');
  leafletPluginsLoaded = true;
}

const unitIcon = L.divIcon({ html: '<div style="background:#2563eb;color:white;border-radius:999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;border:3px solid white;box-shadow:0 2px 10px #0003">E</div>', className: '', iconSize: [28, 28] });
const placeIcon = L.divIcon({ html: '<div style="background:#0f172a;color:white;border-radius:999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid white;box-shadow:0 2px 10px #0003">•</div>', className: '', iconSize: [24, 24] });
const obstacleIcon = L.divIcon({ html: '<div style="background:#f97316;color:white;border-radius:999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid white;box-shadow:0 2px 10px #0003">!</div>', className: '', iconSize: [26, 26] });

function isValidCoord(lat: unknown, lng: unknown) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

export function MarketMap({ result }: { result: AnalysisResult }) {
  // A posicao inicial do mapa e o endereco da empresa encontrado pelo CNPJ.
  if (!isValidCoord(result.unidadeGeo.lat, result.unidadeGeo.lng)) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
        Não foi possível desenhar o mapa porque a coordenada da empresa não foi encontrada.
      </div>
    );
  }

  const center: [number, number] = [result.unidadeGeo.lat, result.unidadeGeo.lng];
  const validPoints = result.points.filter((point) => isValidCoord(point.lat, point.lng));
  const validPlaces = result.strategicPlaces.filter((place) => isValidCoord(place.lat, place.lng));

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Sua empresa">
          <Marker position={center} icon={unitIcon}><Popup><strong>Sua empresa</strong><br />{result.unidade.nomeFantasia || result.unidade.razaoSocial}<br />{result.unidadeGeo.endereco}</Popup></Marker>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Alfinetes Individuais">
          <>{validPoints.map((point) => <CircleMarker key={point.cep} center={[point.lat, point.lng]} radius={7}><Popup><strong>CEP {formatCep(point.cep)}</strong><br />{point.bairro}, {point.cidade}/{point.uf}<br />Distância: {formatKm(point.distanciaLinhaRetaKm)}</Popup></CircleMarker>)}</>
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Agrupado"><ClusterLayer points={validPoints} /></LayersControl.Overlay>
        <LayersControl.Overlay name="Mapa de Calor"><HeatLayer points={validPoints} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Concorrentes e obstáculos">
          <>{validPlaces.map((place, index) => <Marker key={`${place.nome}-${index}`} position={[place.lat, place.lng]} icon={place.categoriaEstrategica.includes('Barreira') ? obstacleIcon : placeIcon}><Popup><strong>{place.nome}</strong><br />{place.categoriaEstrategica}<br />{place.subcategoria}<br />{place.competitorType && <><span>Tipo: {place.competitorType}</span><br /></>}{place.rating && <><span>Avaliação: {place.rating.toFixed(1)} ★ ({place.userRatingCount || 0})</span><br /></>}Distância: {formatKm(place.distanciaKm)}<br />Fonte: {place.fonte}<br />Confiabilidade: {place.confiabilidade}<br />{place.observacaoEstrategica}</Popup></Marker>)}</>
        </LayersControl.Overlay>
      </LayersControl>
      <FitBounds center={center} points={validPoints} places={validPlaces} />
    </MapContainer>
  );
}

function FitBounds({ center, points, places }: { center: [number, number]; points: AnalysisResult['points']; places: AnalysisResult['strategicPlaces'] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [center, ...points.map((p) => [p.lat, p.lng] as [number, number]), ...places.slice(0, 80).map((p) => [p.lat, p.lng] as [number, number])];
    if (coords.length > 1) map.fitBounds(coords, { padding: [30, 30] });
  }, [center, map, places, points]);
  return null;
}

function HeatLayer({ points }: { points: AnalysisResult['points'] }) {
  const map = useMap();
  useEffect(() => {
    let heat: L.Layer | null = null;
    let cancelled = false;
    async function run() {
      await ensureLeafletPluginsLoaded();
      if (cancelled) return;
      if (!points.length) return;
      heat = L.heatLayer(points.map((point) => [point.lat, point.lng, 0.7]), { radius: 28, blur: 20, maxZoom: 17 });
      heat.addTo(map);
    }
    run();
    return () => { cancelled = true; try { if (heat) heat.remove(); } catch {} };
  }, [map, points]);
  return null;
}

function ClusterLayer({ points }: { points: AnalysisResult['points'] }) {
  const map = useMap();
  useEffect(() => {
    let group: L.MarkerClusterGroup | null = null;
    let cancelled = false;
    async function run() {
      await ensureLeafletPluginsLoaded();
      if (cancelled) return;
      group = L.markerClusterGroup({ chunkedLoading: true });
      points.forEach((point) => {
        const marker = L.marker([point.lat, point.lng], { icon: placeIcon });
        marker.bindPopup(`<strong>CEP ${formatCep(point.cep)}</strong><br/>${point.bairro}, ${point.cidade}/${point.uf}<br/>Distância: ${formatKm(point.distanciaLinhaRetaKm)}`);
        group?.addLayer(marker);
      });
      map.addLayer(group);
    }
    run();
    return () => { cancelled = true; try { if (group) map.removeLayer(group); } catch {} };
  }, [map, points]);
  return null;
}
