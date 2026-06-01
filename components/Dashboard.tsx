'use client';

// Este componente mostra o relatorio final.
// Ele transforma o resultado calculado pelo servidor em secoes, graficos, listas, mapa e botao de impressao.
import dynamic from 'next/dynamic';
import { AlertTriangle, MessageSquareText, Printer, Sparkles, Star } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card } from '@/components/ui';
import { PrintableReport } from '@/components/PrintableReport';
import type { AnalysisResult, BusinessModelCanvas } from '@/lib/types';
import type { ReactNode } from 'react';
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
  ['recomendacoes', 'Recomendações Inteligentes'],
  ['mapa', 'Mapa com camadas'],
  ['estatisticas', 'Estatísticas da análise'],
  ['distancias', 'Análise de Distâncias'],
  ['economico', 'Perfil Econômico e Financeiro'],
  ['afinidade', 'Índice de Afinidade por Bairro'],
  ['obstaculos', 'Obstáculos de Matrícula'],
  ['concorrentes', 'Concorrentes e Locais'],
  ['posicionamento', 'Posicionamento da Empresa'],
  ['canvas', 'Canvas Estratégico'],
  ['personas', 'Personas'],
  ['evolucao', 'Evolução Incremental'],
  ['plano', 'Plano de Ação'],
  ['imprimir', 'Imprimir Análise'],
  ['fontes', 'Diagnóstico das Fontes']
];

const CHART_COLORS = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#be185d'];

const CANVAS_BLOCKS: Array<{ key: keyof BusinessModelCanvas; title: string; tone: string }> = [
  { key: 'propostaDeValor', title: 'Proposta de valor', tone: 'border-blue-200 bg-blue-50' },
  { key: 'segmentosDeClientes', title: 'Segmentos de clientes', tone: 'border-emerald-200 bg-emerald-50' },
  { key: 'canais', title: 'Canais', tone: 'border-orange-200 bg-orange-50' },
  { key: 'relacionamentoComClientes', title: 'Relacionamento', tone: 'border-purple-200 bg-purple-50' },
  { key: 'fontesDeReceita', title: 'Fontes de receita', tone: 'border-teal-200 bg-teal-50' },
  { key: 'recursosChave', title: 'Recursos-chave', tone: 'border-slate-200 bg-slate-50' },
  { key: 'atividadesChave', title: 'Atividades-chave', tone: 'border-cyan-200 bg-cyan-50' },
  { key: 'parceriasChave', title: 'Parcerias-chave', tone: 'border-lime-200 bg-lime-50' },
  { key: 'estruturaDeCustos', title: 'Estrutura de custos', tone: 'border-rose-200 bg-rose-50' }
];

function starLabel(rating?: number | null, count?: number | null) {
  if (!rating) return 'Sem avaliação Google disponível';
  return `${rating.toFixed(1)} ★ (${count || 0} avaliações)`;
}

export function Dashboard({ result }: { result: AnalysisResult; readOnly?: boolean }) {
  // Aqui calculamos contadores simples para a parte superior do relatorio.
  // O relatorio ja vem pronto, mas esses numeros ajudam a tela a exibir um resumo rapido.
  const faseColor =
    result.faseMercadoLocal.cor === 'verde'
      ? 'bg-emerald-100 text-emerald-700'
      : result.faseMercadoLocal.cor === 'amarelo'
        ? 'bg-yellow-100 text-yellow-800'
        : result.faseMercadoLocal.cor === 'laranja'
          ? 'bg-orange-100 text-orange-700'
          : 'bg-red-100 text-red-700';
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const direct = result.strategicPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente direto' || place.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
  const indirect = result.strategicPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente indireto' || place.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
  const position = result.posicionamentoUnidade;
  const analysisScope = result.businessActivityDescription ? `Ramo informado: ${result.businessActivityDescription}` : 'Ramo não informado no relatório antigo';
  const smartRecommendations = result.recomendacoesInteligentes || {
    prioridadePrincipal: result.points.length ? 'Priorize os bairros com clientes reais e valide a resposta comercial antes de ampliar investimento.' : 'Valide a demanda no raio analisado antes de assumir quais bairros concentram clientes.',
    brechaCompetitiva: 'Use conveniência, clareza de oferta e prova social local para se diferenciar de alternativas próximas.',
    personaFoco: 'Foque decisores que precisam de confiança, resposta rápida e comparação simples entre opções.',
    objecaoProvavel: 'A objeção mais provável é comparação de preço, reputação ou conveniência.',
    respostaRecomendada: 'Responda com diferencial concreto, prazo, prova social e próximo passo simples.',
    mensagemPronta: `Olá! A ${unitName} atende sua região com orientação clara e resposta rápida. Posso te mostrar a melhor opção para o que você precisa hoje?`
  };
  const businessModelCanvas = normalizeBusinessModelCanvas(result);
  const hasCustomerCepData = result.points.length > 0;
  const visibleSections = sections.filter(([id]) => hasCustomerCepData || !['distancias', 'economico', 'afinidade'].includes(id));

  return (
    <div className="report-shell grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="no-print hidden lg:block">
        <Card className="sticky top-24">
          <h2 className="font-bold text-slate-900">Navegação da Análise</h2>
          <nav className="mt-4 space-y-1">
            {visibleSections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {label}
              </a>
            ))}
          </nav>
        </Card>
      </aside>

      <div id="analysis-report-screen" className="screen-report space-y-6">
        <section id="fase">
          <Card>
            <Badge className={faseColor}>{result.faseMercadoLocal.fase}</Badge>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Inteligência de Mercado — {unitName}</h2>
            <p className="mt-2 text-slate-600">{result.faseMercadoLocal.justificativa}</p>
            <p className="mt-2 text-sm text-slate-500">
              <strong>Raio analisado:</strong> {result.analysisRadiusKm} km
            </p>
            <p className="mt-2 text-sm text-slate-500">
              <strong>Escopo analisado:</strong> {analysisScope}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              <strong>Tipos de concorrentes:</strong> {result.competitorTypes.join(', ')}
            </p>
            <SectionGuide>
              <strong>Como interpretar:</strong> esta é a leitura executiva do mercado local. Ela considera o ramo informado, o raio escolhido e os concorrentes encontrados. {hasCustomerCepData ? 'Como houve CEPs de clientes, as seções de bairros mostram onde a base atual aparece.' : 'Como não houve CEPs de clientes, o relatório não tenta dizer onde os clientes moram; ele foca nos concorrentes ao redor e em como validar demanda.'}
            </SectionGuide>
            {result.iaAviso && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{result.iaAviso}</p>}
          </Card>
        </section>

        <section id="contexto">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Contexto da Região</h2>
            <SectionGuide>
              <strong>Como interpretar:</strong> use estes indicadores para entender o tamanho da amostra e a pressão competitiva. CEPs de clientes só aparecem quando você enviou uma planilha; concorrentes vêm do Google Places dentro do raio escolhido.
            </SectionGuide>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <Metric label="CEPs de clientes" value={result.estatisticas.totalValidos} />
              {hasCustomerCepData && <Metric label="Bairros de clientes" value={result.estatisticas.topBairros.length} />}
              <Metric label="Concorrentes diretos" value={direct} />
              <Metric label="Concorrentes indiretos" value={indirect} />
              <Metric label="Índice de oportunidade" value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
            </div>
          </Card>
        </section>

        <section id="recomendacoes">
          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-bold text-slate-900">Recomendações Inteligentes</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">Síntese para decidir rápido: prioridade, brecha competitiva, persona foco, objeção provável e uma mensagem pronta para usar.</p>
            <SectionGuide>
              <strong>Como interpretar:</strong> esta seção transforma o diagnóstico em orientação comercial. Leia primeiro a prioridade, depois use a brecha competitiva para ajustar discurso, atendimento e anúncio. A mensagem pronta é um ponto de partida para WhatsApp, anúncio local ou resposta de atendimento.
            </SectionGuide>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SmartCard title="Prioridade principal" text={smartRecommendations.prioridadePrincipal} />
              <SmartCard title="Brecha competitiva" text={smartRecommendations.brechaCompetitiva} />
              <SmartCard title="Persona foco" text={smartRecommendations.personaFoco} />
              <SmartCard title="Objeção provável" text={smartRecommendations.objecaoProvavel} />
              <SmartCard title="Resposta recomendada" text={smartRecommendations.respostaRecomendada} />
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-bold text-orange-800">
                  <MessageSquareText className="h-4 w-4" />
                  Mensagem pronta
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-800">{smartRecommendations.mensagemPronta}</p>
              </div>
            </div>
          </Card>
        </section>

        <section id="mapa">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Mapa com camadas</h2>
            <p className="mt-2 text-sm text-slate-500">
              Mapa Google Maps para visualizar a empresa, CEPs informados, locais relevantes, barreiras e concorrentes encontrados. As avaliações e locais continuam vindo do Google Places quando a chave do servidor está configurada.
            </p>
            <SectionGuide>
              <strong>Como interpretar:</strong> a empresa é o ponto de referência. Marcadores de concorrentes mostram pressão competitiva; marcadores de CEPs aparecem apenas quando você enviou clientes. Use o mapa para identificar proximidade, clusters e possíveis lacunas de cobertura.
            </SectionGuide>
            <div className="mt-5">
              <MarketMap result={result} />
            </div>
          </Card>
        </section>

        <section id="estatisticas">
          <StatsPanel result={result} />
        </section>

        {hasCustomerCepData && (
          <>
            <section id="distancias">
              <Card>
                <h2 className="text-2xl font-bold text-slate-900">Análise de Distâncias dos Clientes</h2>
                <SectionGuide>
                  <strong>Como interpretar:</strong> esta seção usa apenas CEPs enviados pelo usuário. Ela ajuda a entender se os clientes atuais estão perto da empresa ou se já aceitam deslocamento maior.
                </SectionGuide>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Metric label="Distância média dos clientes" value={formatKm(result.estatisticas.distanciaMediaKm)} />
                  <Metric label="Distância mediana dos clientes" value={formatKm(result.estatisticas.distanciaMedianaKm)} />
                </div>
              </Card>
            </section>

            <section id="economico">
              <Ranking title="Leitura operacional dos bairros com clientes" items={result.perfilEconomico} />
            </section>

            <section id="afinidade">
              <Ranking title="Índice de Afinidade por Bairro de Cliente" items={result.afinidadePorBairro} />
            </section>
          </>
        )}

        <section id="obstaculos">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Obstáculos que podem atrapalhar a conversão</h2>
            <SectionGuide>
              <strong>Como interpretar:</strong> obstáculos são fatores que podem reduzir conversão. Eles não dizem que a venda é impossível; indicam o que precisa ser respondido no atendimento, na oferta ou na comunicação.
            </SectionGuide>
            <div className="mt-5 grid gap-4">
              {result.obstaculosMatricula.length ? (
                result.obstaculosMatricula.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <strong>
                        {item.bairro} — {item.tipoObstaculo}
                      </strong>
                      <Badge className="bg-slate-100 text-slate-700">{item.impactoEstimado}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.descricao}</p>
                    {item.evidencias.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                        {item.evidencias.map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-sm font-semibold text-slate-800">Ação: {item.acaoRecomendada}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">Nenhum obstáculo relevante foi identificado no raio analisado.</p>
              )}
            </div>
          </Card>
        </section>

        <section id="concorrentes">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Concorrentes e locais relevantes</h2>
            <SectionGuide>
              <strong>Como interpretar:</strong> esta lista mostra os locais encontrados no raio e no ramo informado. Use avaliação, distância e categoria para decidir contra quem comparar a oferta e quais diferenciais precisam ficar explícitos.
            </SectionGuide>
            {result.strategicPlaces.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Nenhum concorrente ou local relevante foi encontrado.</p>
                <p className="mt-2">Veja o diagnóstico das fontes no fim do relatório. Ele mostra se o Google Places foi chamado, qual variável de chave foi usada e qual erro a API retornou.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {result.strategicPlaces.slice(0, 60).map((place) => (
                  <div key={`${place.nome}-${place.lat}-${place.lng}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700">{place.categoriaEstrategica}</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Star className="mr-1 h-3 w-3" />
                        {starLabel(place.rating, place.userRatingCount)}
                      </Badge>
                    </div>
                    <h3 className="mt-2 font-bold text-slate-900">{place.nome}</h3>
                    <p className="mt-1 text-sm text-slate-500">{place.subcategoria} · {place.distanciaKm ? formatKm(place.distanciaKm) : 'distância não calculada'}</p>
                    {place.endereco && <p className="mt-1 text-sm text-slate-500">{place.endereco}</p>}
                    <p className="mt-2 text-sm text-slate-700">{place.observacaoEstrategica}</p>
                    {place.website && <p className="mt-2 break-all text-xs text-blue-700">{place.website}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section id="posicionamento">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Como {unitName} está posicionada</h2>
            <SectionGuide>
              <strong>Como interpretar:</strong> esta seção traduz concorrência e contexto regional em discurso comercial. Use as forças para comunicação, os riscos para preparar objeções e o SWOT para priorizar o que testar primeiro.
            </SectionGuide>
            {position && <GridLists data={position as unknown as Record<string, string[]>} />}
            <SwotMatrix result={result} />
          </Card>
        </section>

        <section id="canvas">
          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-bold text-slate-900">Canvas Estratégico do Negócio</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Síntese automática do modelo de negócio sugerido pela análise. Ela cruza escopo informado, região, concorrentes, canais, parcerias e próximos passos sem exigir que o usuário preencha um Canvas manualmente.
            </p>
            <SectionGuide>
              <strong>Como interpretar:</strong> o Canvas resume como o negócio pode operar melhor no contexto analisado. Ele não é uma nova tarefa; é uma visão organizada de proposta de valor, clientes, canais, parcerias e custos para orientar decisões.
            </SectionGuide>
            <BusinessModelCanvasGrid canvas={businessModelCanvas} />
          </Card>
        </section>

        <section id="personas">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Personas do Público-Alvo</h2>
            <p className="mt-2 text-sm text-slate-500">As personas representam perfis de compra e influência para orientar comunicação, canais e abordagem comercial.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {result.personas.map((persona) => (
                <div key={persona.nomeFicticio} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">{persona.nomeFicticio[0]}</div>
                    <div>
                      <h3 className="font-bold text-slate-900">{persona.nomeFicticio}</h3>
                      <p className="text-sm text-slate-500">{persona.perfilComprador || persona.perfilFamiliar}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>
                      <strong>Decisor:</strong> {persona.decisorPrincipal || persona.idade}
                    </p>
                    <p>
                      <strong>Papel na decisão:</strong> {persona.papelNaDecisao || persona.papelDoFilhoNaDecisao}
                    </p>
                    <p>
                      <strong>Mensagem:</strong> {persona.mensagemRecomendada}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="evolucao">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Evolução incremental da operação atual</h2>
            <GridLists data={result.evolucaoIncremental as unknown as Record<string, string[]>} />
          </Card>
        </section>

        <section id="plano">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Plano de Ação — Próximos Passos</h2>
            <p className="mt-2 text-sm text-slate-500">Quando a chave OpenAI está configurada, esta seção é enriquecida por IA com base no ramo informado, concorrentes, raio de análise, CEPs enviados quando existirem e limitações encontradas.</p>
            <SectionGuide>
              <strong>Como interpretar:</strong> comece pela prioridade 1. Cada ação traz o que fazer, como executar, prazo, responsável e KPI. A ideia é testar pequeno, medir resposta real e só então ampliar investimento.
            </SectionGuide>
            <div className="mt-5 grid gap-4">
              {result.planoDeAcao.map((item) => (
                <div key={item.prioridade} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-orange-100 text-orange-700">
                      Prioridade {item.prioridade} · {item.tipo}
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700">Impacto {item.impactoEsperado}</Badge>
                    <Badge className="bg-slate-100 text-slate-700">Execução {item.facilidadeExecucao}</Badge>
                  </div>
                  <h3 className="mt-3 font-bold text-slate-900">{item.acao}</h3>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>
                      <strong>Prazo:</strong> {item.prazoSugerido}
                    </p>
                    <p>
                      <strong>Custo:</strong> {item.custoEstimado}
                    </p>
                    <p>
                      <strong>Responsável:</strong> {item.responsavelSugerido}
                    </p>
                    <p>
                      <strong>KPI:</strong> {item.kpiParaMedirSucesso}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="imprimir" className="no-print">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Imprimir análise</h2>
            <p className="mt-2 text-sm text-slate-500">Use este botão para abrir a impressão do navegador. A partir daí, você pode imprimir em papel ou salvar como PDF.</p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
              >
                <Printer className="h-4 w-4" />
                Imprimir Análise
              </button>
            </div>
          </Card>
        </section>

        <section id="fontes">
          <Card>
            <h2 className="text-2xl font-bold text-slate-900">Diagnóstico das fontes públicas</h2>
            <p className="mt-2 text-sm text-slate-500">Esta seção fica no final porque é um log técnico: ajuda a conferir chaves, cotas e retornos das APIs sem interromper a leitura estratégica do relatório.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {result.diagnosticoFontesPublicas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
      <PrintableReport result={result} />
    </div>
  );
}

function normalizeBusinessModelCanvas(result: AnalysisResult): BusinessModelCanvas {
  // Relatorios antigos podem nao ter este campo salvo no banco.
  // Este fallback garante que a tela continue abrindo e ainda mostre um Canvas util.
  const saved = (result as AnalysisResult & { businessModelCanvas?: Partial<BusinessModelCanvas> }).businessModelCanvas || {};
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const segment = result.businessActivityDescription || result.unidade.cnaePrincipalDescricao;
  const hasCustomerCepData = result.points.length > 0;
  const topBairro = result.afinidadePorBairro[0]?.bairro || result.unidade.bairro;
  const partner = result.strategicPlaces.find((place) => place.categoriaEstrategica === 'Oportunidade de parceria' || place.categoriaEstrategica === 'Polo gerador de público');
  const fallback: BusinessModelCanvas = {
    propostaDeValor: [`${unitName} deve comunicar ${segment} com clareza, conveniência local e prova social no raio analisado.`],
    segmentosDeClientes: [hasCustomerCepData ? `Clientes próximos de ${topBairro}.` : `Clientes potenciais no raio de ${result.analysisRadiusKm} km.`, 'Compradores que pesquisam e comparam opções no Google.'],
    canais: ['Google Maps e busca local.', 'WhatsApp ou canal direto de atendimento.', hasCustomerCepData ? 'Campanhas por raio nos bairros prioritários.' : `Campanhas por raio de ${result.analysisRadiusKm} km para validar demanda.`],
    relacionamentoComClientes: ['Atendimento consultivo, rápido e com próximo passo simples.', 'Follow-up por bairro, origem do lead e objeção registrada.'],
    fontesDeReceita: [`Venda direta de ${segment}.`, 'Pacotes, planos, recorrência ou serviços complementares quando fizer sentido.'],
    recursosChave: ['Perfil Google atualizado, argumentos comerciais e registro de leads.', 'Equipe ou responsável por resposta rápida.'],
    atividadesChave: ['Monitorar concorrentes, avaliações e objeções.', 'Testar mensagens locais e medir conversão por origem.'],
    parceriasChave: [partner ? `${partner.nome} como possível parceiro ou polo de público.` : 'Negócios complementares da região para indicação mútua.'],
    estruturaDeCustos: ['Mídia local de baixo orçamento para testes.', 'Tempo de atendimento, follow-up, materiais e ferramentas de operação.']
  };

  return CANVAS_BLOCKS.reduce((canvas, block) => {
    const values = Array.isArray(saved[block.key]) ? saved[block.key] as string[] : [];
    canvas[block.key] = values.length ? values : fallback[block.key];
    return canvas;
  }, {} as BusinessModelCanvas);
}

function BusinessModelCanvasGrid({ canvas }: { canvas: BusinessModelCanvas }) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      {CANVAS_BLOCKS.map((block) => (
        <div key={block.key} className={`rounded-2xl border p-4 ${block.tone}`}>
          <h3 className="font-bold text-slate-900">{block.title}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {canvas[block.key].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatsPanel({ result }: { result: AnalysisResult }) {
  const distanceData = result.estatisticas.distribuicaoDistancias.map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));
  const neighborhoodData = result.estatisticas.topBairros.slice(0, 8).map((item, index) => ({
    ...item,
    name: `${item.bairro}, ${item.cidade}`,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));
  const hasCustomerData = result.estatisticas.totalValidos > 0;

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-900">Estatísticas da análise</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Estes números resumem a base analisada. Quando há CEPs, os gráficos mostram clientes por distância e bairro. Quando não há CEPs, os gráficos de clientes são omitidos e a análise se concentra no raio, nos concorrentes e no índice de oportunidade.
      </p>
      <SectionGuide>
        <strong>Como interpretar:</strong> não leia concorrentes como clientes. CEPs válidos representam apenas a planilha enviada; concorrentes e locais vêm do Google Places. Sem planilha, não há bairros de clientes para interpretar.
      </SectionGuide>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Metric label="CEPs válidos" value={result.estatisticas.totalValidos} />
        <Metric label="CEPs ignorados" value={result.estatisticas.totalInvalidos} />
        <Metric label="Distância média" value={hasCustomerData ? formatKm(result.estatisticas.distanciaMediaKm) : 'Sem planilha'} />
        <Metric label="Oportunidade" value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-bold text-slate-900">CEPs por faixa de distância</h3>
          <p className="mt-1 text-sm text-slate-500">Mostra quantos CEPs da planilha ficam perto ou longe da empresa.</p>
          {hasCustomerData ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="faixa" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, 'CEPs']} labelFormatter={(label) => `Faixa: ${label}`} />
                  <Bar dataKey="total" name="CEPs" radius={[8, 8, 0, 0]}>
                    {distanceData.map((entry) => (
                      <Cell key={entry.faixa} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartMessage text="Envie uma planilha de CEPs para ver a distribuição por distância." />
          )}
        </div>

        <div>
          <h3 className="font-bold text-slate-900">Bairros com mais CEPs enviados</h3>
          <p className="mt-1 text-sm text-slate-500">Ajuda a enxergar onde a base atual de clientes se concentra.</p>
          {neighborhoodData.length ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={neighborhoodData} dataKey="total" nameKey="name" outerRadius={95} label>
                    {neighborhoodData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'CEPs']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartMessage text="Sem bairros para exibir porque nenhuma planilha de CEPs foi usada nesta análise." />
          )}
        </div>
      </div>
    </Card>
  );
}

function SwotMatrix({ result }: { result: AnalysisResult }) {
  const position = result.posicionamentoUnidade;
  const threats = [
    ...result.obstaculosMatricula.slice(0, 2).map((item) => `${item.tipoObstaculo} em ${item.bairro}: ${item.acaoRecomendada}`),
    ...result.strategicPlaces
      .filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente'))
      .slice(0, 2)
      .map((place) => `${place.nome} aparece como ${place.categoriaEstrategica.toLowerCase()} a ${formatKm(place.distanciaKm)}.`)
  ];

  return (
    <div className="mt-6">
      <h3 className="text-xl font-bold text-slate-900">Resumo SWOT</h3>
      <p className="mt-1 text-sm text-slate-500">Uma leitura rápida das forças, fraquezas, oportunidades e ameaças percebidas na análise.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SwotCard title="Forças" color="border-emerald-200 bg-emerald-50 text-emerald-900" items={position.forcasAtuais.slice(0, 4)} />
        <SwotCard title="Fraquezas" color="border-amber-200 bg-amber-50 text-amber-900" items={position.riscosDePosicionamento.slice(0, 4)} />
        <SwotCard title="Oportunidades" color="border-blue-200 bg-blue-50 text-blue-900" items={[...position.diferenciaisFrenteConcorrentes, ...position.ajustesIncrementaisSugeridos, ...position.hipotesesParaTestar].slice(0, 4)} />
        <SwotCard title="Ameaças" color="border-rose-200 bg-rose-50 text-rose-900" items={threats.length ? threats : position.riscosDePosicionamento.slice(0, 4)} />
      </div>
    </div>
  );
}

function SwotCard({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <h4 className="font-bold">{title}</h4>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChartMessage({ text }: { text: string }) {
  return <div className="mt-4 flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function SectionGuide({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">{children}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function SmartCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function Ranking({ title, items }: { title: string; items: AnalysisResult['afinidadePorBairro'] }) {
  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <SectionGuide>
        <strong>Como interpretar:</strong> este ranking usa somente CEPs de clientes enviados. A nota combina presença de clientes, distância e pressão competitiva local para ajudar a escolher onde testar campanhas e follow-up.
      </SectionGuide>
      <div className="mt-5 space-y-3">
        {items.slice(0, 10).map((item, index) => (
          <div key={`${item.bairro}-${item.cidade}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">
                  {index + 1}. {item.bairro}, {item.cidade}
                </p>
                <p className="text-sm text-slate-500">
                  {item.cepCount} CEP(s) · distância média {formatKm(item.distanciaMediaKm)}
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">{item.score}/100</Badge>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {item.evidencias.slice(0, 3).map((evidence) => (
                <li key={evidence}>{evidence}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold text-slate-700">{item.acaoRecomendada}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GridLists({ data }: { data: Record<string, readonly string[]> }) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {Object.entries(data).map(([key, values]) => (
        <div key={key} className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-bold capitalize text-slate-900">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
