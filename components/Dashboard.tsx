'use client';

// Relatorio objetivo.
// A ideia aqui e mostrar poucas secoes, com leitura direta para decisao comercial.
import dynamic from 'next/dynamic';
import { AlertTriangle, MapPinned, MessageSquareText, Printer, Sparkles, Star, Target } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { PrintableReport } from '@/components/PrintableReport';
import type { AnalysisResult } from '@/lib/types';
import type { ReactNode } from 'react';
import { formatKm } from '@/lib/utils';

const MarketMap = dynamic(
  () => import('@/components/MarketMap').then((mod) => mod.MarketMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-sm text-slate-500">
        Carregando mapa da regiao...
      </div>
    )
  }
);

function starLabel(rating?: number | null, count?: number | null) {
  if (!rating) return 'Sem avaliacao Google';
  return `${rating.toFixed(1)} ★ (${count || 0})`;
}

export function Dashboard({ result }: { result: AnalysisResult; readOnly?: boolean }) {
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const hasCustomerCepData = result.points.length > 0;
  const directCompetitors = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente direto'));
  const indirectCompetitors = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente indireto'));
  const topCompetitors = [...result.strategicPlaces]
    .filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente'))
    .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 12);
  const phaseColor =
    result.faseMercadoLocal.cor === 'verde'
      ? 'bg-emerald-100 text-emerald-700'
      : result.faseMercadoLocal.cor === 'amarelo'
        ? 'bg-yellow-100 text-yellow-800'
        : result.faseMercadoLocal.cor === 'laranja'
          ? 'bg-orange-100 text-orange-700'
          : 'bg-red-100 text-red-700';

  return (
    <div id="analysis-report-screen" className="screen-report space-y-6">
      <Card>
        <Badge className={phaseColor}>{result.faseMercadoLocal.fase}</Badge>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">Analise de mercado — {unitName}</h2>
        <p className="mt-3 text-slate-600">{result.faseMercadoLocal.justificativa}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric label="Ramo analisado" value={result.businessActivityDescription || 'Nao informado'} compact />
          <Metric label="Raio" value={`${result.analysisRadiusKm} km`} />
          <Metric label="Concorrentes diretos" value={directCompetitors.length} />
          <Metric label="Oportunidade" value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
        </div>
        <Guide>
          Leia esta primeira parte como uma fotografia rapida do mercado. Ela cruza o ramo informado, o endereco de referencia, o raio escolhido e os concorrentes encontrados. {hasCustomerCepData ? 'Como houve CEPs de clientes, a analise tambem mostra onde sua base atual aparece.' : 'Como nao houve CEPs de clientes, a analise nao tenta inferir bairros de clientes; ela foca nos concorrentes ao redor.'}
        </Guide>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">O que fazer primeiro</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">Esta secao transforma o diagnostico em orientacao pratica de comunicacao e acao.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Insight title="Prioridade" text={result.recomendacoesInteligentes.prioridadePrincipal} />
          <Insight title="Brecha competitiva" text={result.recomendacoesInteligentes.brechaCompetitiva} />
          <Insight title="Objeção provável" text={result.recomendacoesInteligentes.objecaoProvavel} />
          <Insight title="Resposta recomendada" text={result.recomendacoesInteligentes.respostaRecomendada} />
        </div>
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-orange-800">
            <MessageSquareText className="h-4 w-4" />
            Mensagem pronta para testar
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-800">{result.recomendacoesInteligentes.mensagemPronta}</p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">Mapa da regiao</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">Use o mapa para enxergar a empresa, o raio, concorrentes e, quando enviados, CEPs de clientes.</p>
        <Guide>
          O mapa ajuda a perceber concentracao: muitos pontos proximos podem indicar pressao competitiva; poucos pontos podem indicar espaco para validar demanda. CEPs de clientes so aparecem se voce enviou a planilha.
        </Guide>
        <div className="mt-5">
          <MarketMap result={result} />
        </div>
      </Card>

      {hasCustomerCepData && (
        <Card>
          <h2 className="text-2xl font-bold text-slate-900">Clientes informados</h2>
          <p className="mt-2 text-sm text-slate-500">Esta leitura usa somente os CEPs enviados. Ela nao mistura concorrentes com clientes.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Metric label="CEPs validos" value={result.estatisticas.totalValidos} />
            <Metric label="CEPs ignorados" value={result.estatisticas.totalInvalidos} />
            <Metric label="Distancia media" value={formatKm(result.estatisticas.distanciaMediaKm)} />
            <Metric label="Distancia mediana" value={formatKm(result.estatisticas.distanciaMedianaKm)} />
          </div>
          {result.afinidadePorBairro.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {result.afinidadePorBairro.slice(0, 6).map((item) => (
                <div key={`${item.bairro}-${item.cidade}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">{item.bairro}, {item.cidade}</h3>
                    <Badge className="bg-emerald-100 text-emerald-700">{item.score}/100</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.cepCount} CEP(s) enviados · distancia media {formatKm(item.distanciaMediaKm)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{item.acaoRecomendada}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">Concorrentes principais</h2>
        <p className="mt-2 text-sm text-slate-500">
          Lista enxuta dos concorrentes mais relevantes encontrados no Google Places dentro do raio escolhido. Use-a para comparar reputacao, distancia, proposta e atendimento.
        </p>
        {topCompetitors.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Nenhum concorrente relevante foi encontrado.</p>
            <p className="mt-2">Veja o diagnostico tecnico no fim do relatorio para conferir se o Google Places foi executado corretamente.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {topCompetitors.map((place) => (
              <div key={`${place.nome}-${place.lat}-${place.lng}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">{place.categoriaEstrategica}</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Star className="mr-1 h-3 w-3" />
                    {starLabel(place.rating, place.userRatingCount)}
                  </Badge>
                </div>
                <h3 className="mt-2 font-bold text-slate-900">{place.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">{place.subcategoria} · {place.distanciaKm ? formatKm(place.distanciaKm) : 'distancia nao calculada'}</p>
                {place.endereco && <p className="mt-1 text-sm text-slate-500">{place.endereco}</p>}
                <p className="mt-2 text-sm text-slate-700">{place.observacaoEstrategica}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">Posicionamento e proximos passos</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">Use este bloco para ajustar discurso, atendimento e os primeiros testes comerciais.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ListCard title="Forcas para comunicar" items={result.posicionamentoUnidade.forcasAtuais.slice(0, 3)} />
          <ListCard title="Riscos para responder" items={result.posicionamentoUnidade.riscosDePosicionamento.slice(0, 3)} />
          <ListCard title="Diferenciais a reforcar" items={result.posicionamentoUnidade.diferenciaisFrenteConcorrentes.slice(0, 3)} />
          <ListCard title="Hipoteses para testar" items={result.posicionamentoUnidade.hipotesesParaTestar.slice(0, 3)} />
        </div>
        <div className="mt-5 grid gap-4">
          {result.planoDeAcao.slice(0, 3).map((item) => (
            <div key={item.prioridade} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-orange-100 text-orange-700">Prioridade {item.prioridade}</Badge>
                <Badge className="bg-slate-100 text-slate-700">{item.tipo}</Badge>
                <Badge className="bg-slate-100 text-slate-700">{item.prazoSugerido}</Badge>
              </div>
              <h3 className="mt-3 font-bold text-slate-900">{item.acao}</h3>
              <p className="mt-2 text-sm text-slate-600"><strong>Como medir:</strong> {item.kpiParaMedirSucesso}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="no-print">
        <h2 className="text-2xl font-bold text-slate-900">Imprimir analise</h2>
        <p className="mt-2 text-sm text-slate-500">Gere um PDF organizado pelo navegador com resumo, mapa, graficos e secoes principais.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
        >
          <Printer className="h-4 w-4" />
          Imprimir Analise
        </button>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-lg font-bold text-slate-900">Diagnostico das fontes publicas</summary>
          <p className="mt-3 text-sm text-slate-500">Log tecnico para conferir chaves, cotas e retornos das APIs usadas.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {result.diagnosticoFontesPublicas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </Card>

      {result.iaAviso && <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">{result.iaAviso}</p>}
      <PrintableReport result={result} />
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 font-bold text-slate-900 ${compact ? 'text-base leading-6' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

function Guide({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">{children}</div>;
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
