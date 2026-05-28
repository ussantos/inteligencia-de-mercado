'use client';

// Este componente mostra o relatorio final.
// Ele pega o resultado calculado pelo servidor e transforma em secoes, graficos, listas, mapa e botoes de exportacao.
import { AlertTriangle, Star } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExportButtons } from '@/components/ExportButtons';
import dynamic from 'next/dynamic';
import { Badge, Card } from '@/components/ui';
import type { AnalysisResult } from '@/lib/types';
import { formatKm } from '@/lib/utils';

const MarketMap = dynamic(
  // O mapa usa APIs do navegador, como window e document.
  // Por isso carregamos o mapa so no cliente, evitando erro durante a renderizacao no servidor.
  () => import('@/components/MarketMap').then((mod) => mod.MarketMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-sm text-slate-500">
        Carregando mapa da região...
      </div>
    )
  }
);

const sections = [
  ['fase', 'Fase do Mercado Local'],
  ['contexto', 'Contexto da Região'],
  ['mapa', 'Mapa com camadas'],
  ['estatisticas', 'Painel de Estatísticas'],
  ['distancias', 'Análise de Distâncias'],
  ['economico', 'Perfil Econômico e Financeiro'],
  ['afinidade', 'Índice de Afinidade por Bairro'],
  ['obstaculos', 'Obstáculos de Matrícula'],
  ['concorrentes', 'Concorrentes e Locais'],
  ['posicionamento', 'Posicionamento da Unidade'],
  ['personas', 'Personas'],
  ['evolucao', 'Evolução Incremental'],
  ['fontes', 'Diagnóstico das Fontes'],
  ['plano', 'Plano de Ação'],
  ['exportacoes', 'Exportações']
];

function starLabel(rating?: number | null, count?: number | null) {
  if (!rating) return 'Sem avaliação Google disponível';
  return `${rating.toFixed(1)} ★ (${count || 0} avaliações)`;
}

export function Dashboard({ result, readOnly = false }: { result: AnalysisResult; readOnly?: boolean }) {
  // Aqui calculamos contadores simples para a parte superior do relatorio.
  // O relatorio ja vem pronto, mas esses numeros ajudam a tela a exibir um resumo rapido.
  const faseColor = result.faseMercadoLocal.cor === 'verde' ? 'bg-emerald-100 text-emerald-700' : result.faseMercadoLocal.cor === 'amarelo' ? 'bg-yellow-100 text-yellow-800' : result.faseMercadoLocal.cor === 'laranja' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const direct = result.strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente direto' || p.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
  const indirect = result.strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente indireto' || p.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
  const position = result.posicionamentoUnidade;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="no-print hidden lg:block">
        <Card className="sticky top-24">
          <h2 className="font-bold text-slate-900">Navegação da Análise</h2>
          <nav className="mt-4 space-y-1">
            {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">{label}</a>)}
          </nav>
        </Card>
      </aside>

      <div id="analysis-report" className="space-y-6">
        <section id="fase"><Card><Badge className={faseColor}>{result.faseMercadoLocal.fase}</Badge><h2 className="mt-3 text-3xl font-bold text-slate-900">Inteligência de Mercado — {unitName}</h2><p className="mt-2 text-slate-600">{result.faseMercadoLocal.justificativa}</p><p className="mt-2 text-sm text-slate-500"><strong>Raio analisado:</strong> {result.analysisRadiusKm} km</p><p className="mt-2 text-sm text-slate-500"><strong>CNAEs analisados:</strong> {result.selectedCnaes.map((cnae) => cnae.descricao).join(' · ')}</p><p className="mt-2 text-sm text-slate-500"><strong>Tipos de concorrentes:</strong> {result.competitorTypes.join(', ')}</p>{result.iaAviso && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{result.iaAviso}</p>}</Card></section>

        <section id="contexto"><Card><h2 className="text-2xl font-bold text-slate-900">Contexto da Região</h2><div className="mt-4 grid gap-4 md:grid-cols-4"><Metric label="CEPs de clientes" value={result.estatisticas.totalValidos} /><Metric label="Bairros/regiões" value={result.estatisticas.topBairros.length} /><Metric label="Concorrentes diretos" value={direct} /><Metric label="Índice de oportunidade" value={`${result.estatisticas.indiceOportunidadeMercado}/100`} /></div></Card></section>

        <section id="mapa"><Card><h2 className="text-2xl font-bold text-slate-900">Mapa com camadas</h2><p className="mt-2 text-sm text-slate-500">Mapa OpenStreetMap para visualização. Concorrentes e avaliações vêm do Google Places quando a chave está configurada.</p><div className="mt-5"><MarketMap result={result} /></div></Card></section>

        <section id="estatisticas"><Card><h2 className="text-2xl font-bold text-slate-900">Painel de Estatísticas</h2><div className="mt-5 grid gap-6 lg:grid-cols-2"><div className="h-72"><ResponsiveContainer><BarChart data={result.estatisticas.distribuicaoDistancias}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="faixa" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="total" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div><div className="h-72"><ResponsiveContainer><PieChart><Pie data={result.estatisticas.topBairros} dataKey="total" nameKey="bairro" outerRadius={95} label>{result.estatisticas.topBairros.map((_, index) => <Cell key={index} />)}</Pie></PieChart></ResponsiveContainer></div></div></Card></section>

        <section id="distancias"><Card><h2 className="text-2xl font-bold text-slate-900">Análise de Distâncias</h2>{result.points.length ? <div className="mt-4 grid gap-4 md:grid-cols-2"><Metric label="Distância média dos clientes" value={formatKm(result.estatisticas.distanciaMediaKm)} /><Metric label="Distância mediana dos clientes" value={formatKm(result.estatisticas.distanciaMedianaKm)} /></div> : <p className="mt-3 text-sm text-slate-600">Nenhuma planilha de CEPs foi enviada. A análise usa o raio de atuação em torno da unidade e os locais encontrados no Google Places.</p>}</Card></section>

        <section id="economico"><Ranking title="Perfil Econômico e Financeiro" items={result.perfilEconomico} /></section>
        <section id="afinidade"><Ranking title="Índice de Afinidade por Bairro" items={result.afinidadePorBairro} /></section>

        <section id="obstaculos"><Card><h2 className="text-2xl font-bold text-slate-900">Obstáculos que podem atrapalhar a conversão</h2><div className="mt-5 grid gap-4">{result.obstaculosMatricula.length ? result.obstaculosMatricula.map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /><strong>{item.bairro} — {item.tipoObstaculo}</strong><Badge className="bg-slate-100 text-slate-700">{item.impactoEstimado}</Badge></div><p className="mt-2 text-sm text-slate-600">{item.descricao}</p>{item.evidencias.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{item.evidencias.map((ev) => <li key={ev}>{ev}</li>)}</ul>}<p className="mt-2 text-sm font-semibold text-slate-800">Ação: {item.acaoRecomendada}</p></div>) : <p className="text-sm text-slate-600">Nenhum obstáculo relevante foi identificado no raio analisado.</p>}</div></Card></section>

        <section id="concorrentes"><Card><h2 className="text-2xl font-bold text-slate-900">Concorrentes e locais relevantes</h2>{result.strategicPlaces.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700"><p className="font-semibold text-slate-900">Nenhum concorrente ou local relevante foi encontrado.</p><p className="mt-2">Verifique se a variável GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_SERVER_API_KEY está configurada e se a API Places está ativa no Google Cloud.</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{result.strategicPlaces.slice(0, 60).map((place) => <div key={`${place.nome}-${place.lat}-${place.lng}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-slate-100 text-slate-700">{place.categoriaEstrategica}</Badge><Badge className="bg-yellow-100 text-yellow-800"><Star className="mr-1 h-3 w-3" />{starLabel(place.rating, place.userRatingCount)}</Badge></div><h3 className="mt-2 font-bold text-slate-900">{place.nome}</h3><p className="mt-1 text-sm text-slate-500">{place.subcategoria} · {place.distanciaKm ? formatKm(place.distanciaKm) : 'distância não calculada'}</p>{place.endereco && <p className="mt-1 text-sm text-slate-500">{place.endereco}</p>}<p className="mt-2 text-sm text-slate-700">{place.observacaoEstrategica}</p>{place.website && <p className="mt-2 text-xs text-blue-700 break-all">{place.website}</p>}</div>)}</div>}</Card></section>

        <section id="posicionamento"><Card><h2 className="text-2xl font-bold text-slate-900">Como {unitName} está posicionada</h2>{position && <GridLists data={position as unknown as Record<string, string[]>} />}</Card></section>
        <section id="personas"><Card><h2 className="text-2xl font-bold text-slate-900">Personas do Público-Alvo</h2><p className="mt-2 text-sm text-slate-500">As personas representam perfis de compra e influência para orientar comunicação, canais e abordagem comercial.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{result.personas.map((persona) => <div key={persona.nomeFicticio} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">{persona.nomeFicticio[0]}</div><div><h3 className="font-bold text-slate-900">{persona.nomeFicticio}</h3><p className="text-sm text-slate-500">{persona.perfilComprador || persona.perfilFamiliar}</p></div></div><div className="mt-3 space-y-2 text-sm text-slate-700"><p><strong>Decisor:</strong> {persona.decisorPrincipal || persona.idade}</p><p><strong>Papel na decisão:</strong> {persona.papelNaDecisao || persona.papelDoFilhoNaDecisao}</p><p><strong>Mensagem:</strong> {persona.mensagemRecomendada}</p></div></div>)}</div></Card></section>
        <section id="evolucao"><Card><h2 className="text-2xl font-bold text-slate-900">Evolução incremental da operação atual</h2><GridLists data={result.evolucaoIncremental as unknown as Record<string, string[]>} /></Card></section>
        <section id="fontes"><Card><h2 className="text-2xl font-bold text-slate-900">Diagnóstico das fontes públicas</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">{result.diagnosticoFontesPublicas.map((item) => <li key={item}>{item}</li>)}</ul></Card></section>
        <section id="plano"><Card><h2 className="text-2xl font-bold text-slate-900">Plano de Ação — Próximos Passos</h2><div className="mt-5 grid gap-4">{result.planoDeAcao.map((item) => <div key={item.prioridade} className="rounded-2xl border border-slate-200 p-4"><Badge className="bg-orange-100 text-orange-700">Prioridade {item.prioridade} · {item.tipo}</Badge><h3 className="mt-2 font-bold text-slate-900">{item.acao}</h3><p className="mt-1 text-sm text-slate-600">KPI: {item.kpiParaMedirSucesso}</p></div>)}</div></Card></section>
        <section id="exportacoes"><Card><h2 className="text-2xl font-bold text-slate-900">Exportações</h2><p className="mt-2 text-sm text-slate-500">PDF client-side e XLSX com abas de análise.</p><div className="mt-5"><ExportButtons result={result} readOnly={readOnly} /></div></Card></section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>; }
function Ranking({ title, items }: { title: string; items: AnalysisResult['afinidadePorBairro'] }) { return <Card><h2 className="text-2xl font-bold text-slate-900">{title}</h2><div className="mt-5 space-y-3">{items.slice(0, 10).map((item, index) => <div key={`${item.bairro}-${item.cidade}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-slate-900">{index + 1}. {item.bairro}, {item.cidade}</p><p className="text-sm text-slate-500">{item.cepCount} CEP(s) · distância média {formatKm(item.distanciaMediaKm)}</p></div><Badge className="bg-emerald-100 text-emerald-700">{item.score}/100</Badge></div><ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{item.evidencias.slice(0, 3).map((ev) => <li key={ev}>{ev}</li>)}</ul><p className="mt-2 text-sm font-semibold text-slate-700">{item.acaoRecomendada}</p></div>)}</div></Card>; }
function GridLists({ data }: { data: Record<string, readonly string[]> }) { return <div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(data).map(([key, values]) => <div key={key} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold capitalize text-slate-900">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">{values.map((value) => <li key={value}>{value}</li>)}</ul></div>)}</div>; }
