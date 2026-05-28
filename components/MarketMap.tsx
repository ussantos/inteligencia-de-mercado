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
const obstacleIcon = L.divIcon({ html: '<div style="background:#f97316;color:white;border-radius:999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid white;box-shadow:0 2px 10px #0003">!</div>', className: '', iconSize: [26, 26] });

export function MarketMap({ result }: { result: AnalysisResult }) {
  // A posicao inicial do mapa e o endereco da empresa encontrado pelo CNPJ.
  const center: [number, number] = [result.unidadeGeo.lat, result.unidadeGeo.lng];

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Sua empresa">
          <Marker position={center} icon={unitIcon}><Popup><strong>Sua empresa</strong><br />{result.unidade.nomeFantasia || result.unidade.razaoSocial}<br />{result.unidadeGeo.endereco}</Popup></Marker>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Alfinetes Individuais">
          <>{result.points.map((point) => <CircleMarker key={point.cep} center={[point.lat, point.lng]} radius={7}><Popup><strong>CEP {formatCep(point.cep)}</strong><br />{point.bairro}, {point.cidade}/{point.uf}<br />Distância: {formatKm(point.distanciaLinhaRetaKm)}</Popup></CircleMarker>)}</>
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Agrupado"><ClusterLayer result={result} /></LayersControl.Overlay>
        <LayersControl.Overlay name="Mapa de Calor"><HeatLayer result={result} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Concorrentes e obstáculos">
          <>{result.strategicPlaces.map((place, index) => <Marker key={`${place.nome}-${index}`} position={[place.lat, place.lng]} icon={place.categoriaEstrategica.includes('Barreira') ? obstacleIcon : undefined}><Popup><strong>{place.nome}</strong><br />{place.categoriaEstrategica}<br />{place.subcategoria}<br />{place.competitorType && <><span>Tipo: {place.competitorType}</span><br /></>}{place.rating && <><span>Avaliação: {place.rating.toFixed(1)} ★ ({place.userRatingCount || 0})</span><br /></>}Distância: {formatKm(place.distanciaKm)}<br />Fonte: {place.fonte}<br />Confiabilidade: {place.confiabilidade}<br />{place.observacaoEstrategica}</Popup></Marker>)}</>
        </LayersControl.Overlay>
      </LayersControl>
      <FitBounds result={result} />
    </MapContainer>
  );
}

function FitBounds({ result }: { result: AnalysisResult }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [[result.unidadeGeo.lat, result.unidadeGeo.lng], ...result.points.map((p) => [p.lat, p.lng] as [number, number]), ...result.strategicPlaces.slice(0, 80).map((p) => [p.lat, p.lng] as [number, number])];
    if (coords.length > 1) map.fitBounds(coords, { padding: [30, 30] });
  }, [map, result]);
  return null;
}

function HeatLayer({ result }: { result: AnalysisResult }) {
  const map = useMap();
  useEffect(() => {
    let heat: L.Layer | null = null;
    let cancelled = false;
    async function run() {
      await ensureLeafletPluginsLoaded();
      if (cancelled) return;
      heat = L.heatLayer(result.points.map((point) => [point.lat, point.lng, 0.7]), { radius: 28, blur: 20, maxZoom: 17 });
      heat.addTo(map);
    }
    run();
    return () => { cancelled = true; if (heat) heat.remove(); };
  }, [map, result.points]);
  return null;
}

function ClusterLayer({ result }: { result: AnalysisResult }) {
  const map = useMap();
  useEffect(() => {
    let group: L.MarkerClusterGroup | null = null;
    let cancelled = false;
    async function run() {
      await ensureLeafletPluginsLoaded();
      if (cancelled) return;
      group = L.markerClusterGroup({ chunkedLoading: true });
      result.points.forEach((point) => {
        const marker = L.marker([point.lat, point.lng]);
        marker.bindPopup(`<strong>CEP ${formatCep(point.cep)}</strong><br/>${point.bairro}, ${point.cidade}/${point.uf}<br/>Distância: ${formatKm(point.distanciaLinhaRetaKm)}`);
        group?.addLayer(marker);
      });
      map.addLayer(group);
    }
    run();
    return () => { cancelled = true; if (group) map.removeLayer(group); };
  }, [map, result.points]);
  return null;
}
