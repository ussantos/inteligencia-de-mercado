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
import { DEFAULT_LANGUAGE, categoryLabel, phaseLabel, simpleLabel, type AppLanguage } from '@/lib/i18n';

const MarketMap = dynamic(
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

function tr(language: AppLanguage, ptText: string, enText: string) {
  return language === 'en-US' ? enText : ptText;
}

function starLabel(language: AppLanguage, rating?: number | null, count?: number | null) {
  if (!rating) return tr(language, 'Sem avaliação Google', 'No Google rating');
  return `${rating.toFixed(1)} ★ (${count || 0})`;
}

export function Dashboard({ result, language: languageProp }: { result: AnalysisResult; readOnly?: boolean; language?: AppLanguage }) {
  const language = languageProp || result.language || DEFAULT_LANGUAGE;
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
        <Badge className={phaseColor}>{phaseLabel(language, result.faseMercadoLocal.fase)}</Badge>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">{tr(language, 'Análise de mercado', 'Market analysis')} — {unitName}</h2>
        <p className="mt-3 text-slate-600">{result.faseMercadoLocal.justificativa}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric label={tr(language, 'Ramo analisado', 'Analyzed activity')} value={result.businessActivityDescription || tr(language, 'Não informado', 'Not provided')} compact />
          <Metric label={tr(language, 'Raio', 'Radius')} value={`${result.analysisRadiusKm} km`} />
          <Metric label={tr(language, 'Concorrentes diretos', 'Direct competitors')} value={directCompetitors.length} />
          <Metric label={tr(language, 'Oportunidade', 'Opportunity')} value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
        </div>
        <Guide>
          {tr(
            language,
            `Leia esta primeira parte como uma fotografia rápida do mercado. Ela cruza o ramo informado, o endereço de referência, o raio escolhido e os concorrentes encontrados. ${hasCustomerCepData ? 'Como houve CEPs de clientes, a análise também mostra onde sua base atual aparece.' : 'Como não houve CEPs de clientes, a análise não tenta inferir bairros de clientes; ela foca nos concorrentes ao redor.'}`,
            `Read this first block as a quick market snapshot. It combines the stated activity, reference address, selected radius, and mapped competitors. ${hasCustomerCepData ? 'Because customer ZIP/postal codes were uploaded, the analysis also shows where the current customer base appears.' : 'Because no customer ZIP/postal codes were uploaded, the analysis does not infer customer neighborhoods; it focuses on nearby competitors.'}`
          )}
        </Guide>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'O que fazer primeiro', 'What to do first')}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">{tr(language, 'Esta seção transforma o diagnóstico em orientação prática de comunicação e ação.', 'This section turns the diagnosis into practical communication and action guidance.')}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Insight title={tr(language, 'Prioridade', 'Priority')} text={result.recomendacoesInteligentes.prioridadePrincipal} />
          <Insight title={tr(language, 'Brecha competitiva', 'Competitive gap')} text={result.recomendacoesInteligentes.brechaCompetitiva} />
          <Insight title={tr(language, 'Objeção provável', 'Likely objection')} text={result.recomendacoesInteligentes.objecaoProvavel} />
          <Insight title={tr(language, 'Resposta recomendada', 'Recommended response')} text={result.recomendacoesInteligentes.respostaRecomendada} />
        </div>
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-orange-800">
            <MessageSquareText className="h-4 w-4" />
            {tr(language, 'Mensagem pronta para testar', 'Message ready to test')}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-800">{result.recomendacoesInteligentes.mensagemPronta}</p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'Mapa da região', 'Region map')}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">{tr(language, 'Use o mapa para enxergar a empresa, o raio, concorrentes e, quando enviados, CEPs de clientes.', 'Use the map to see the company, radius, competitors, and customer ZIP/postal codes when uploaded.')}</p>
        <Guide>
          {tr(language, 'O mapa ajuda a perceber concentração: muitos pontos próximos podem indicar pressão competitiva; poucos pontos podem indicar espaço para validar demanda. CEPs de clientes só aparecem se você enviou a planilha.', 'The map helps you see concentration: many nearby points may indicate competitive pressure; few points may indicate room to validate demand. Customer ZIP/postal codes only appear if you uploaded the spreadsheet.')}
        </Guide>
        <div className="mt-5">
          <MarketMap result={result} language={language} />
        </div>
      </Card>

      {hasCustomerCepData && (
        <Card>
          <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'Clientes informados', 'Uploaded customers')}</h2>
          <p className="mt-2 text-sm text-slate-500">{tr(language, 'Esta leitura usa somente os CEPs enviados. Ela não mistura concorrentes com clientes.', 'This reading uses only uploaded ZIP/postal codes. It does not mix competitors with customers.')}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Metric label={tr(language, 'CEPs válidos', 'Valid ZIPs')} value={result.estatisticas.totalValidos} />
            <Metric label={tr(language, 'CEPs ignorados', 'Ignored ZIPs')} value={result.estatisticas.totalInvalidos} />
            <Metric label={tr(language, 'Distância média', 'Average distance')} value={formatKm(result.estatisticas.distanciaMediaKm)} />
            <Metric label={tr(language, 'Distância mediana', 'Median distance')} value={formatKm(result.estatisticas.distanciaMedianaKm)} />
          </div>
          {result.afinidadePorBairro.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {result.afinidadePorBairro.slice(0, 6).map((item) => (
                <div key={`${item.bairro}-${item.cidade}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">{item.bairro}, {item.cidade}</h3>
                    <Badge className="bg-emerald-100 text-emerald-700">{item.score}/100</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.cepCount} {tr(language, 'CEP(s) enviados', 'uploaded ZIP/postal code(s)')} · {tr(language, 'distância média', 'average distance')} {formatKm(item.distanciaMediaKm)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{item.acaoRecomendada}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'Concorrentes principais', 'Main competitors')}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {tr(language, 'Lista enxuta dos concorrentes mais relevantes encontrados no Google Places dentro do raio escolhido. Use-a para comparar reputação, distância, proposta e atendimento.', 'A focused list of the most relevant competitors found through Google Places inside the selected radius. Use it to compare reputation, distance, offer, and service.')}
        </p>
        {topCompetitors.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{tr(language, 'Nenhum concorrente relevante foi encontrado.', 'No relevant competitor was found.')}</p>
            <p className="mt-2">{tr(language, 'Veja o diagnóstico técnico no fim do relatório para conferir se o Google Places foi executado corretamente.', 'See the technical diagnosis at the end of the report to confirm whether Google Places ran correctly.')}</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {topCompetitors.map((place) => (
              <div key={`${place.nome}-${place.lat}-${place.lng}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">{categoryLabel(language, place.categoriaEstrategica)}</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Star className="mr-1 h-3 w-3" />
                    {starLabel(language, place.rating, place.userRatingCount)}
                  </Badge>
                </div>
                <h3 className="mt-2 font-bold text-slate-900">{place.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">{place.subcategoria} · {place.distanciaKm ? formatKm(place.distanciaKm) : tr(language, 'distância não calculada', 'distance not calculated')}</p>
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
          <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'Posicionamento e próximos passos', 'Positioning and next steps')}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">{tr(language, 'Use este bloco para ajustar discurso, atendimento e os primeiros testes comerciais.', 'Use this block to adjust messaging, service, and the first commercial tests.')}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ListCard title={tr(language, 'Forças para comunicar', 'Strengths to communicate')} items={result.posicionamentoUnidade.forcasAtuais.slice(0, 3)} />
          <ListCard title={tr(language, 'Riscos para responder', 'Risks to address')} items={result.posicionamentoUnidade.riscosDePosicionamento.slice(0, 3)} />
          <ListCard title={tr(language, 'Diferenciais a reforçar', 'Differentiators to reinforce')} items={result.posicionamentoUnidade.diferenciaisFrenteConcorrentes.slice(0, 3)} />
          <ListCard title={tr(language, 'Hipóteses para testar', 'Hypotheses to test')} items={result.posicionamentoUnidade.hipotesesParaTestar.slice(0, 3)} />
        </div>
        <div className="mt-5 grid gap-4">
          {result.planoDeAcao.slice(0, 3).map((item) => (
            <div key={item.prioridade} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-orange-100 text-orange-700">{tr(language, 'Prioridade', 'Priority')} {item.prioridade}</Badge>
                <Badge className="bg-slate-100 text-slate-700">{simpleLabel(language, item.tipo)}</Badge>
                <Badge className="bg-slate-100 text-slate-700">{item.prazoSugerido}</Badge>
              </div>
              <h3 className="mt-3 font-bold text-slate-900">{item.acao}</h3>
              <p className="mt-2 text-sm text-slate-600"><strong>{tr(language, 'Como medir:', 'How to measure:')}</strong> {item.kpiParaMedirSucesso}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="no-print">
        <h2 className="text-2xl font-bold text-slate-900">{tr(language, 'Imprimir análise', 'Print analysis')}</h2>
        <p className="mt-2 text-sm text-slate-500">{tr(language, 'Gere um PDF organizado pelo navegador com resumo, mapa, gráficos e seções principais.', 'Generate a browser PDF with summary, map, charts, and main sections.')}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
        >
          <Printer className="h-4 w-4" />
          {tr(language, 'Imprimir Análise', 'Print Analysis')}
        </button>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-lg font-bold text-slate-900">{tr(language, 'Diagnóstico das fontes públicas', 'Public source diagnosis')}</summary>
          <p className="mt-3 text-sm text-slate-500">{tr(language, 'Log técnico para conferir chaves, cotas e retornos das APIs usadas.', 'Technical log to review keys, quotas, and responses from the APIs used.')}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {result.diagnosticoFontesPublicas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </Card>

      {result.iaAviso && <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">{result.iaAviso}</p>}
      <PrintableReport result={result} language={language} />
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
