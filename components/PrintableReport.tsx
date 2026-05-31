'use client';

// Este componente monta uma versao do relatorio feita so para impressao.
// A tela interativa continua existindo, mas o navegador imprime esta estrutura compacta em A4 retrato.
import type { AnalysisResult } from '@/lib/types';
import type { BusinessModelCanvas } from '@/lib/types';
import type { ReactNode } from 'react';
import { formatKm } from '@/lib/utils';

const PRINT_CHART_COLORS = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#be185d'];
const PRINT_CANVAS_BLOCKS: Array<{ key: keyof BusinessModelCanvas; title: string }> = [
  { key: 'propostaDeValor', title: 'Proposta de valor' },
  { key: 'segmentosDeClientes', title: 'Segmentos de clientes' },
  { key: 'canais', title: 'Canais' },
  { key: 'relacionamentoComClientes', title: 'Relacionamento' },
  { key: 'fontesDeReceita', title: 'Fontes de receita' },
  { key: 'recursosChave', title: 'Recursos-chave' },
  { key: 'atividadesChave', title: 'Atividades-chave' },
  { key: 'parceriasChave', title: 'Parcerias-chave' },
  { key: 'estruturaDeCustos', title: 'Estrutura de custos' }
];
const PRINT_MAP_WIDTH = 1024;
const PRINT_MAP_HEIGHT = 512;
const PRINT_MAP_TILE_SIZE = 256;

function starLabel(rating?: number | null, count?: number | null) {
  if (!rating) return 'Sem avaliacao Google';
  return `${rating.toFixed(1)} (${count || 0} avaliacoes)`;
}

function valueOrDash(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function isValidCoord(lat: unknown, lng: unknown) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

function mapCategoryColor(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('barreira')) return '#f97316';
  if (normalized.includes('parceria')) return '#16a34a';
  if (normalized.includes('polo')) return '#7c3aed';
  if (normalized.includes('indireto')) return '#475569';
  if (normalized.includes('direto')) return '#0f172a';
  return '#0891b2';
}

function estimatePrintMapZoom(radiusKm: number) {
  if (radiusKm <= 3) return 14;
  if (radiusKm <= 7) return 13;
  if (radiusKm <= 15) return 12;
  if (radiusKm <= 30) return 11;
  return 10;
}

function latLngToWorldPixel(lat: number, lng: number, zoom: number) {
  // A imagem estatica do OSM usa Web Mercator; esta conta transforma latitude/longitude
  // em pixels no mesmo sistema para posicionarmos os marcadores sobre a imagem impressa.
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function buildPrintMapContext(result: AnalysisResult) {
  const zoom = estimatePrintMapZoom(result.analysisRadiusKm);
  const center = latLngToWorldPixel(result.unidadeGeo.lat, result.unidadeGeo.lng, zoom);
  return {
    zoom,
    topLeftX: center.x - PRINT_MAP_WIDTH / 2,
    topLeftY: center.y - PRINT_MAP_HEIGHT / 2
  };
}

function buildPrintMapTiles(result: AnalysisResult) {
  const { zoom, topLeftX, topLeftY } = buildPrintMapContext(result);
  const startX = Math.floor(topLeftX / PRINT_MAP_TILE_SIZE);
  const endX = Math.floor((topLeftX + PRINT_MAP_WIDTH) / PRINT_MAP_TILE_SIZE);
  const startY = Math.floor(topLeftY / PRINT_MAP_TILE_SIZE);
  const endY = Math.floor((topLeftY + PRINT_MAP_HEIGHT) / PRINT_MAP_TILE_SIZE);
  const maxTile = 2 ** zoom;
  const subdomains = ['a', 'b', 'c'];
  const tiles: Array<{ key: string; url: string; left: number; top: number; width: number; height: number }> = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const subdomain = subdomains[Math.abs(x + y) % subdomains.length];
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        url: `https://${subdomain}.tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x * PRINT_MAP_TILE_SIZE - topLeftX) / PRINT_MAP_WIDTH) * 100,
        top: ((y * PRINT_MAP_TILE_SIZE - topLeftY) / PRINT_MAP_HEIGHT) * 100,
        width: (PRINT_MAP_TILE_SIZE / PRINT_MAP_WIDTH) * 100,
        height: (PRINT_MAP_TILE_SIZE / PRINT_MAP_HEIGHT) * 100
      });
    }
  }

  return tiles;
}

function buildPrintMapPoints(result: AnalysisResult) {
  const { zoom, topLeftX, topLeftY } = buildPrintMapContext(result);
  const raw = [
    { id: 'company', lat: result.unidadeGeo.lat, lng: result.unidadeGeo.lng, color: '#1d4ed8', size: 18, label: 'Empresa' },
    ...result.points.slice(0, 80).map((point, index) => ({ id: `cep-${index}`, lat: point.lat, lng: point.lng, color: '#0284c7', size: 9, label: 'CEP' })),
    ...result.strategicPlaces.slice(0, 120).map((place, index) => ({ id: `place-${index}`, lat: place.lat, lng: place.lng, color: mapCategoryColor(place.categoriaEstrategica), size: 10, label: place.categoriaEstrategica }))
  ].filter((point) => isValidCoord(point.lat, point.lng));

  return raw.map((point) => {
    const pixel = latLngToWorldPixel(point.lat as number, point.lng as number, zoom);
    return {
      ...point,
      x: ((pixel.x - topLeftX) / PRINT_MAP_WIDTH) * 100,
      y: ((pixel.y - topLeftY) / PRINT_MAP_HEIGHT) * 100
    };
  }).filter((point) => point.x >= -4 && point.x <= 104 && point.y >= -4 && point.y <= 104);
}

function PrintMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="print-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PrintList({ items, limit = 5 }: { items: string[]; limit?: number }) {
  return (
    <ul className="print-list">
      {items.slice(0, limit).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PrintBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function PrintPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`print-page ${className}`}>{children}</article>;
}

function PrintGeoMap({ result }: { result: AnalysisResult }) {
  const tiles = buildPrintMapTiles(result);
  const points = buildPrintMapPoints(result);
  return (
    <PrintBlock title="Mapa da região analisada">
      <div className="print-map">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            className="print-map-tile"
            style={{ left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` }}
          />
        ))}
        {points.map((point) => (
          <span
            key={point.id}
            className={`print-map-point ${point.id === 'company' ? 'print-map-company' : ''}`}
            style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: point.color, width: `${point.size}px`, height: `${point.size}px` }}
            title={point.label}
          />
        ))}
      </div>
      <div className="print-map-legend">
        <span><i style={{ backgroundColor: '#2563eb' }} /> Empresa</span>
        <span><i style={{ backgroundColor: '#38bdf8' }} /> CEPs/clientes</span>
        <span><i style={{ backgroundColor: '#0f172a' }} /> Concorrentes</span>
        <span><i style={{ backgroundColor: '#f97316' }} /> Barreiras</span>
        <span><i style={{ backgroundColor: '#16a34a' }} /> Parcerias</span>
      </div>
      <p className="print-caption">Mapa OpenStreetMap usado apenas na impressão, com marcadores calculados a partir das coordenadas da análise. O mapa interativo completo fica disponível na tela.</p>
    </PrintBlock>
  );
}

function PrintBarChart({ title, rows }: { title: string; rows: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <PrintBlock title={title}>
      <div className="print-bars">
        {rows.map((row, index) => (
          <div key={row.label} className="print-bar-row">
            <span>{row.label}</span>
            <div>
              <i style={{ width: `${Math.max(4, (row.value / max) * 100)}%`, backgroundColor: row.color || PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] }} />
            </div>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </PrintBlock>
  );
}

function PrintCategoryChart({ result }: { result: AnalysisResult }) {
  const counts = new Map<string, number>();
  result.strategicPlaces.forEach((place) => {
    const key = place.categoriaEstrategica || 'Outros';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rows = [...counts.entries()].map(([label, value], index) => ({ label, value, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] })).slice(0, 8);
  return <PrintBarChart title="Locais por categoria estratégica" rows={rows.length ? rows : [{ label: 'Sem locais mapeados', value: 0 }]} />;
}

function normalizePrintBusinessModelCanvas(result: AnalysisResult): BusinessModelCanvas {
  // A impressao tambem precisa abrir relatorios antigos, criados antes do Canvas existir.
  const saved = (result as AnalysisResult & { businessModelCanvas?: Partial<BusinessModelCanvas> }).businessModelCanvas || {};
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const segment = result.businessActivityDescription || result.selectedCnaes.map((cnae) => cnae.descricao).join(', ') || result.unidade.cnaePrincipalDescricao;
  const topBairro = result.afinidadePorBairro[0]?.bairro || result.unidade.bairro;
  const fallback: BusinessModelCanvas = {
    propostaDeValor: [`${unitName} deve comunicar ${segment} com clareza, conveniencia local e prova social para ${topBairro}.`],
    segmentosDeClientes: [`Clientes proximos de ${topBairro}.`, 'Compradores que pesquisam e comparam opcoes no Google.'],
    canais: ['Google Maps e busca local.', 'WhatsApp ou canal direto de atendimento.', 'Campanhas por raio nos bairros prioritarios.'],
    relacionamentoComClientes: ['Atendimento consultivo, rapido e com proximo passo simples.', 'Follow-up por bairro, origem do lead e objecao registrada.'],
    fontesDeReceita: [`Venda direta de ${segment}.`, 'Pacotes, planos, recorrencia ou servicos complementares quando fizer sentido.'],
    recursosChave: ['Perfil Google atualizado, argumentos comerciais e registro de leads.', 'Equipe ou responsavel por resposta rapida.'],
    atividadesChave: ['Monitorar concorrentes, avaliacoes e objecoes.', 'Testar mensagens locais e medir conversao por origem.'],
    parceriasChave: ['Negocios complementares da regiao para indicacao mutua.'],
    estruturaDeCustos: ['Midia local de baixo orçamento para testes.', 'Tempo de atendimento, follow-up, materiais e ferramentas de operacao.']
  };

  return PRINT_CANVAS_BLOCKS.reduce((canvas, block) => {
    const values = Array.isArray(saved[block.key]) ? saved[block.key] as string[] : [];
    canvas[block.key] = values.length ? values : fallback[block.key];
    return canvas;
  }, {} as BusinessModelCanvas);
}

export function PrintableReport({ result }: { result: AnalysisResult }) {
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const direct = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente direto')).length;
  const indirect = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente indireto')).length;
  const recommendations = result.recomendacoesInteligentes || {
    prioridadePrincipal: 'Priorize os bairros com maior afinidade e valide a resposta comercial antes de ampliar investimento.',
    brechaCompetitiva: 'Use conveniencia, clareza de oferta e prova social local para se diferenciar de alternativas proximas.',
    personaFoco: 'Foque decisores que precisam de confianca, resposta rapida e comparacao simples entre opcoes.',
    objecaoProvavel: 'A objecao mais provavel e comparacao de preco, reputacao ou conveniencia.',
    respostaRecomendada: 'Responda com diferencial concreto, prazo, prova social e proximo passo simples.',
    mensagemPronta: `A ${unitName} atende sua regiao com orientacao clara e resposta rapida. Posso mostrar a melhor opcao para o que voce precisa hoje?`
  };
  const position = result.posicionamentoUnidade;
  const businessModelCanvas = normalizePrintBusinessModelCanvas(result);
  const topPlaces = result.strategicPlaces.slice(0, 12);
  const topAffinity = result.afinidadePorBairro.slice(0, 6);
  const topEconomic = result.perfilEconomico.slice(0, 6);
  const distanceRows = result.estatisticas.distribuicaoDistancias.map((item, index) => ({ label: item.faixa, value: item.total, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] }));
  const neighborhoodRows = result.estatisticas.topBairros.slice(0, 8).map((item, index) => ({ label: `${item.bairro}, ${item.cidade}`, value: item.total, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] }));
  const scopeLabel = [
    result.selectedCnaes.length ? result.selectedCnaes.map((cnae) => cnae.descricao).join(' | ') : '',
    result.businessActivityDescription ? `Descricao: ${result.businessActivityDescription}` : ''
  ].filter(Boolean).join(' | ') || 'Escopo não informado';

  return (
    <div id="analysis-report" className="print-report">
      <PrintPage className="print-cover">
        <header className="print-header">
          <div>
            <p className="print-kicker">Inteligencia de Mercado</p>
            <h1>Analise regional de concorrencia</h1>
            <p>{unitName}</p>
          </div>
          <div className="print-date">
            <strong>{new Date(result.createdAt).toLocaleDateString('pt-BR')}</strong>
            <span>Raio: {result.analysisRadiusKm} km</span>
          </div>
        </header>

        <div className="print-summary">
          <span>{result.faseMercadoLocal.fase}</span>
          <p>{result.faseMercadoLocal.justificativa}</p>
        </div>

        <div className="print-metrics-grid">
          <PrintMetric label="CEPs validos" value={result.estatisticas.totalValidos} />
          <PrintMetric label="Bairros/regioes" value={result.estatisticas.topBairros.length} />
          <PrintMetric label="Concorrentes diretos" value={direct} />
          <PrintMetric label="Concorrentes indiretos" value={indirect} />
          <PrintMetric label="Oportunidade" value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
          <PrintMetric label="Distancia media" value={result.estatisticas.totalValidos ? formatKm(result.estatisticas.distanciaMediaKm) : 'Sem planilha'} />
        </div>

        <div className="print-two-columns">
          <PrintBlock title="Empresa analisada">
            <p><strong>Razao social:</strong> {result.unidade.razaoSocial}</p>
            <p><strong>CNPJ:</strong> {result.unidade.cnpj}</p>
            <p><strong>Endereco:</strong> {result.unidade.logradouro}, {result.unidade.numero} - {result.unidade.bairro}, {result.unidade.municipio}/{result.unidade.uf}</p>
            <p><strong>CNAE principal:</strong> {result.unidade.cnaePrincipalCodigo} - {result.unidade.cnaePrincipalDescricao}</p>
          </PrintBlock>
          <PrintBlock title="Escopo da analise">
            <p><strong>Escopo usado:</strong> {scopeLabel}</p>
            {result.businessActivityDescription && <p><strong>Descricao informada:</strong> {result.businessActivityDescription}</p>}
            <p><strong>Tipos de concorrentes:</strong> {result.competitorTypes.join(', ')}</p>
          </PrintBlock>
        </div>
      </PrintPage>

      <PrintPage>
        <h2>Mapa e gráficos da análise</h2>
        <PrintGeoMap result={result} />
        <div className="print-two-columns">
          <PrintBarChart title="CEPs por faixa de distância" rows={distanceRows.length ? distanceRows : [{ label: 'Sem planilha', value: 0 }]} />
          <PrintBarChart title="Bairros com mais CEPs enviados" rows={neighborhoodRows.length ? neighborhoodRows : [{ label: 'Sem bairros', value: 0 }]} />
        </div>
        <PrintCategoryChart result={result} />
      </PrintPage>

      <PrintPage>
        <h2>Recomendacoes e estatisticas</h2>
        <div className="print-two-columns">
          <PrintBlock title="Prioridade principal">
            <p>{recommendations.prioridadePrincipal}</p>
          </PrintBlock>
          <PrintBlock title="Brecha competitiva">
            <p>{recommendations.brechaCompetitiva}</p>
          </PrintBlock>
          <PrintBlock title="Persona foco">
            <p>{recommendations.personaFoco}</p>
          </PrintBlock>
          <PrintBlock title="Objecao e resposta">
            <p><strong>Objecao provavel:</strong> {recommendations.objecaoProvavel}</p>
            <p><strong>Resposta:</strong> {recommendations.respostaRecomendada}</p>
          </PrintBlock>
        </div>
        <PrintBlock title="Mensagem pronta">
          <p>{recommendations.mensagemPronta}</p>
        </PrintBlock>

        <div className="print-two-columns">
          <PrintBlock title="Resumo de distância">
            <p><strong>Distância média:</strong> {result.estatisticas.totalValidos ? formatKm(result.estatisticas.distanciaMediaKm) : 'Sem planilha'}</p>
            <p><strong>Distância mediana:</strong> {result.estatisticas.totalValidos ? formatKm(result.estatisticas.distanciaMedianaKm) : 'Sem planilha'}</p>
          </PrintBlock>
          <PrintBlock title="Índice de oportunidade">
            <p>{result.estatisticas.indiceOportunidadeMercado}/100</p>
          </PrintBlock>
        </div>
      </PrintPage>

      <PrintPage>
        <h2>Bairros e oportunidades</h2>
        <div className="print-two-columns">
          <PrintBlock title="Indice de afinidade por bairro">
            {topAffinity.map((item, index) => (
              <div key={`${item.bairro}-${item.cidade}`} className="print-ranking-item">
                <strong>{index + 1}. {item.bairro}, {item.cidade} - {item.score}/100</strong>
                <p>{item.acaoRecomendada}</p>
              </div>
            ))}
          </PrintBlock>
          <PrintBlock title="Perfil economico e financeiro">
            {topEconomic.map((item, index) => (
              <div key={`${item.bairro}-${item.cidade}`} className="print-ranking-item">
                <strong>{index + 1}. {item.bairro}, {item.cidade} - {item.score}/100</strong>
                <p>{item.acaoRecomendada}</p>
              </div>
            ))}
          </PrintBlock>
        </div>
      </PrintPage>

      <PrintPage>
        <h2>Concorrentes, barreiras e posicionamento</h2>
        <PrintBlock title="Concorrentes e locais relevantes">
          {topPlaces.length ? (
            <table className="print-table print-places-table">
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Categoria</th>
                  <th>Distancia</th>
                  <th>Avaliacao</th>
                </tr>
              </thead>
              <tbody>
                {topPlaces.map((place) => (
                  <tr key={`${place.nome}-${place.lat}-${place.lng}`}>
                    <td>{place.nome}</td>
                    <td>{place.categoriaEstrategica}</td>
                    <td>{place.distanciaKm ? formatKm(place.distanciaKm) : '-'}</td>
                    <td>{starLabel(place.rating, place.userRatingCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Nenhum concorrente ou local relevante foi encontrado. Consulte o diagnostico das fontes no fim do relatorio.</p>
          )}
        </PrintBlock>

        <PrintBlock title="Obstaculos de conversao">
          {result.obstaculosMatricula.length ? (
            result.obstaculosMatricula.slice(0, 6).map((item) => (
              <div key={`${item.bairro}-${item.tipoObstaculo}`} className="print-ranking-item">
                <strong>{item.bairro} - {item.tipoObstaculo} ({item.impactoEstimado})</strong>
                <p>{item.descricao}</p>
                <p><strong>Acao:</strong> {item.acaoRecomendada}</p>
              </div>
            ))
          ) : (
            <p>Nenhum obstaculo relevante foi identificado.</p>
          )}
        </PrintBlock>
      </PrintPage>

      <PrintPage>
        <h2>SWOT e plano de acao</h2>
        <div className="print-swot">
          <PrintBlock title="Forcas">
            <PrintList items={position.forcasAtuais} limit={4} />
          </PrintBlock>
          <PrintBlock title="Fraquezas">
            <PrintList items={position.riscosDePosicionamento} limit={4} />
          </PrintBlock>
          <PrintBlock title="Oportunidades">
            <PrintList items={[...position.diferenciaisFrenteConcorrentes, ...position.ajustesIncrementaisSugeridos, ...position.hipotesesParaTestar]} limit={4} />
          </PrintBlock>
          <PrintBlock title="Ameacas">
            <PrintList items={result.obstaculosMatricula.map((item) => `${item.tipoObstaculo} em ${item.bairro}: ${item.acaoRecomendada}`)} limit={4} />
          </PrintBlock>
        </div>

        <PrintBlock title="Plano de acao">
          {result.planoDeAcao.slice(0, 6).map((item) => (
            <div key={item.prioridade} className="print-action-item">
              <strong>{item.prioridade}. {item.acao}</strong>
              <p>{item.tipo} | Impacto {item.impactoEsperado} | Execucao {item.facilidadeExecucao} | Prazo {item.prazoSugerido}</p>
              <p><strong>KPI:</strong> {item.kpiParaMedirSucesso}</p>
            </div>
          ))}
        </PrintBlock>
      </PrintPage>

      <PrintPage>
        <h2>Canvas do modelo de negocio</h2>
        <p className="print-page-intro">Sintese aplicada do modelo de negocio sugerido pela analise, considerando escopo informado, regiao, concorrentes, canais e possiveis parcerias.</p>
        <div className="print-canvas-grid">
          {PRINT_CANVAS_BLOCKS.map((block) => (
            <PrintBlock key={block.key} title={block.title}>
              <PrintList items={businessModelCanvas[block.key]} limit={4} />
            </PrintBlock>
          ))}
        </div>
      </PrintPage>

      <PrintPage>
        <h2>Personas, evolucao e fontes</h2>
        <div className="print-two-columns">
          <PrintBlock title="Personas principais">
            {result.personas.slice(0, 4).map((persona) => (
              <div key={persona.nomeFicticio} className="print-ranking-item">
                <strong>{persona.nomeFicticio}</strong>
                <p>{valueOrDash(persona.perfilComprador || persona.perfilFamiliar)}</p>
                <p>{persona.mensagemRecomendada}</p>
              </div>
            ))}
          </PrintBlock>
          <PrintBlock title="Evolucao incremental">
            <p><strong>Manter:</strong></p>
            <PrintList items={result.evolucaoIncremental.manter} limit={3} />
            <p><strong>Melhorar:</strong></p>
            <PrintList items={result.evolucaoIncremental.melhorar} limit={3} />
            <p><strong>Adicionar:</strong></p>
            <PrintList items={result.evolucaoIncremental.adicionar} limit={3} />
          </PrintBlock>
        </div>
        <PrintBlock title="Diagnostico das fontes publicas">
          <ul className="print-diagnostics">
            {result.diagnosticoFontesPublicas.slice(0, 12).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PrintBlock>
      </PrintPage>
    </div>
  );
}
