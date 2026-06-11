'use client';

// Este componente monta uma versao do relatorio feita so para impressao.
// A tela interativa continua existindo, mas o navegador imprime esta estrutura compacta em A4 retrato.
import type { AnalysisResult } from '@/lib/types';
import type { BusinessModelCanvas } from '@/lib/types';
import type { ReactNode } from 'react';
import { formatKm } from '@/lib/utils';
import { DEFAULT_LANGUAGE, categoryLabel, competitorLabel, phaseLabel, simpleLabel, type AppLanguage } from '@/lib/i18n';

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

function tr(language: AppLanguage, ptText: string, enText: string) {
  return language === 'en-US' ? enText : ptText;
}

function printCanvasBlocks(language: AppLanguage): Array<{ key: keyof BusinessModelCanvas; title: string }> {
  return PRINT_CANVAS_BLOCKS.map((block) => ({
    ...block,
    title: tr(language, block.title, {
      'Proposta de valor': 'Value proposition',
      'Segmentos de clientes': 'Customer segments',
      Canais: 'Channels',
      Relacionamento: 'Customer relationship',
      'Fontes de receita': 'Revenue streams',
      'Recursos-chave': 'Key resources',
      'Atividades-chave': 'Key activities',
      'Parcerias-chave': 'Key partnerships',
      'Estrutura de custos': 'Cost structure'
    }[block.title] || block.title)
  }));
}

function starLabel(language: AppLanguage, rating?: number | null, count?: number | null) {
  if (!rating) return tr(language, 'Sem avaliação Google', 'No Google rating');
  return `${rating.toFixed(1)} (${count || 0} ${tr(language, 'avaliações', 'reviews')})`;
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

function PrintGeoMap({ result, language }: { result: AnalysisResult; language: AppLanguage }) {
  const tiles = buildPrintMapTiles(result);
  const points = buildPrintMapPoints(result);
  return (
    <PrintBlock title={tr(language, 'Mapa da região analisada', 'Analyzed region map')}>
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
        <span><i style={{ backgroundColor: '#2563eb' }} /> {tr(language, 'Empresa', 'Company')}</span>
        <span><i style={{ backgroundColor: '#38bdf8' }} /> {tr(language, 'CEPs/clientes', 'ZIPs/customers')}</span>
        <span><i style={{ backgroundColor: '#0f172a' }} /> {tr(language, 'Concorrentes', 'Competitors')}</span>
        <span><i style={{ backgroundColor: '#f97316' }} /> {tr(language, 'Barreiras', 'Barriers')}</span>
        <span><i style={{ backgroundColor: '#16a34a' }} /> {tr(language, 'Parcerias', 'Partnerships')}</span>
      </div>
      <p className="print-caption">{tr(language, 'Mapa OpenStreetMap usado apenas na impressão, com marcadores calculados a partir das coordenadas da análise. O mapa interativo completo fica disponível na tela.', 'OpenStreetMap is used only for printing, with markers calculated from the analysis coordinates. The full interactive map remains available on screen.')}</p>
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

function PrintCategoryChart({ result, language }: { result: AnalysisResult; language: AppLanguage }) {
  const counts = new Map<string, number>();
  result.strategicPlaces.forEach((place) => {
    const key = categoryLabel(language, place.categoriaEstrategica || 'Outros');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rows = [...counts.entries()].map(([label, value], index) => ({ label, value, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] })).slice(0, 8);
  return <PrintBarChart title={tr(language, 'Locais por categoria estratégica', 'Places by strategic category')} rows={rows.length ? rows : [{ label: tr(language, 'Sem locais mapeados', 'No mapped places'), value: 0 }]} />;
}

function normalizePrintBusinessModelCanvas(result: AnalysisResult): BusinessModelCanvas {
  // A impressao tambem precisa abrir relatorios antigos, criados antes do Canvas existir.
  const saved = (result as AnalysisResult & { businessModelCanvas?: Partial<BusinessModelCanvas> }).businessModelCanvas || {};
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const segment = result.businessActivityDescription || result.unidade.cnaePrincipalDescricao;
  const hasCustomerCepData = result.points.length > 0;
  const topBairro = result.afinidadePorBairro[0]?.bairro || result.unidade.bairro;
  const fallback: BusinessModelCanvas = {
    propostaDeValor: [`${unitName} deve comunicar ${segment} com clareza, conveniência local e prova social no raio analisado.`],
    segmentosDeClientes: [hasCustomerCepData ? `Clientes próximos de ${topBairro}.` : `Clientes potenciais no raio de ${result.analysisRadiusKm} km.`, 'Compradores que pesquisam e comparam opções no Google.'],
    canais: ['Google Maps e busca local.', 'WhatsApp ou canal direto de atendimento.', hasCustomerCepData ? 'Campanhas por raio nos bairros prioritários.' : `Campanhas por raio de ${result.analysisRadiusKm} km para validar demanda.`],
    relacionamentoComClientes: ['Atendimento consultivo, rápido e com próximo passo simples.', 'Follow-up por bairro, origem do lead e objeção registrada.'],
    fontesDeReceita: [`Venda direta de ${segment}.`, 'Pacotes, planos, recorrência ou serviços complementares quando fizer sentido.'],
    recursosChave: ['Perfil Google atualizado, argumentos comerciais e registro de leads.', 'Equipe ou responsável por resposta rápida.'],
    atividadesChave: ['Monitorar concorrentes, avaliações e objeções.', 'Testar mensagens locais e medir conversão por origem.'],
    parceriasChave: ['Negócios complementares da região para indicação mútua.'],
    estruturaDeCustos: ['Mídia local de baixo orçamento para testes.', 'Tempo de atendimento, follow-up, materiais e ferramentas de operação.']
  };

  return PRINT_CANVAS_BLOCKS.reduce((canvas, block) => {
    const values = Array.isArray(saved[block.key]) ? saved[block.key] as string[] : [];
    canvas[block.key] = values.length ? values : fallback[block.key];
    return canvas;
  }, {} as BusinessModelCanvas);
}

export function PrintableReport({ result, language: languageProp }: { result: AnalysisResult; language?: AppLanguage }) {
  const language = languageProp || result.language || DEFAULT_LANGUAGE;
  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const hasCustomerCepData = result.points.length > 0;
  const direct = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente direto')).length;
  const indirect = result.strategicPlaces.filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente indireto')).length;
  const recommendations = result.recomendacoesInteligentes || {
    prioridadePrincipal: hasCustomerCepData ? 'Priorize os bairros com clientes reais e valide a resposta comercial antes de ampliar investimento.' : 'Valide a demanda no raio analisado antes de assumir quais bairros concentram clientes.',
    brechaCompetitiva: 'Use conveniência, clareza de oferta e prova social local para se diferenciar de alternativas próximas.',
    personaFoco: 'Foque decisores que precisam de confiança, resposta rápida e comparação simples entre opções.',
    objecaoProvavel: 'A objeção mais provável é comparação de preço, reputação ou conveniência.',
    respostaRecomendada: 'Responda com diferencial concreto, prazo, prova social e próximo passo simples.',
    mensagemPronta: `A ${unitName} atende sua região com orientação clara e resposta rápida. Posso mostrar a melhor opção para o que você precisa hoje?`
  };
  const position = result.posicionamentoUnidade;
  const businessModelCanvas = normalizePrintBusinessModelCanvas(result);
  const topPlaces = result.strategicPlaces.slice(0, 12);
  const topAffinity = result.afinidadePorBairro.slice(0, 6);
  const topEconomic = result.perfilEconomico.slice(0, 6);
  const distanceRows = result.estatisticas.distribuicaoDistancias.map((item, index) => ({ label: item.faixa, value: item.total, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] }));
  const neighborhoodRows = result.estatisticas.topBairros.slice(0, 8).map((item, index) => ({ label: `${item.bairro}, ${item.cidade}`, value: item.total, color: PRINT_CHART_COLORS[index % PRINT_CHART_COLORS.length] }));
  const scopeLabel = result.businessActivityDescription ? tr(language, `Ramo informado: ${result.businessActivityDescription}`, `Stated activity: ${result.businessActivityDescription}`) : tr(language, 'Ramo não informado no relatório antigo', 'Activity not provided in this older report');
  const canvasBlocks = printCanvasBlocks(language);

  return (
    <div id="analysis-report" className="print-report">
      <PrintPage className="print-cover">
        <header className="print-header">
          <div>
            <p className="print-kicker">{tr(language, 'Inteligência de Mercado', 'Market Intelligence')}</p>
            <h1>{tr(language, 'Análise regional de concorrência', 'Regional competitive analysis')}</h1>
            <p>{unitName}</p>
          </div>
          <div className="print-date">
            <strong>{new Date(result.createdAt).toLocaleDateString('pt-BR')}</strong>
            <span>{tr(language, 'Raio:', 'Radius:')} {result.analysisRadiusKm} km</span>
          </div>
        </header>

        <div className="print-summary">
          <span>{phaseLabel(language, result.faseMercadoLocal.fase)}</span>
          <p>{result.faseMercadoLocal.justificativa}</p>
        </div>

        <div className="print-metrics-grid">
          <PrintMetric label={tr(language, 'CEPs válidos', 'Valid ZIPs')} value={result.estatisticas.totalValidos} />
          <PrintMetric label={tr(language, 'Bairros de clientes', 'Customer neighborhoods')} value={hasCustomerCepData ? result.estatisticas.topBairros.length : tr(language, 'Sem planilha', 'No spreadsheet')} />
          <PrintMetric label={tr(language, 'Concorrentes diretos', 'Direct competitors')} value={direct} />
          <PrintMetric label={tr(language, 'Concorrentes indiretos', 'Indirect competitors')} value={indirect} />
          <PrintMetric label={tr(language, 'Oportunidade', 'Opportunity')} value={`${result.estatisticas.indiceOportunidadeMercado}/100`} />
          <PrintMetric label={tr(language, 'Distância média', 'Average distance')} value={result.estatisticas.totalValidos ? formatKm(result.estatisticas.distanciaMediaKm) : tr(language, 'Sem planilha', 'No spreadsheet')} />
        </div>

        <div className="print-two-columns">
          <PrintBlock title={tr(language, 'Empresa analisada', 'Analyzed company')}>
            <p><strong>{tr(language, 'Razão social:', 'Legal name:')}</strong> {result.unidade.razaoSocial}</p>
            {result.unidade.cnpj && <p><strong>CNPJ:</strong> {result.unidade.cnpj}</p>}
            <p><strong>{tr(language, 'Endereço:', 'Address:')}</strong> {result.unidade.logradouro}, {result.unidade.numero} - {result.unidade.bairro}, {result.unidade.municipio}/{result.unidade.uf}</p>
          </PrintBlock>
          <PrintBlock title={tr(language, 'Escopo da análise', 'Analysis scope')}>
            <p><strong>{tr(language, 'Escopo usado:', 'Scope used:')}</strong> {scopeLabel}</p>
            <p><strong>{tr(language, 'Tipos de concorrentes:', 'Competitor types:')}</strong> {result.competitorTypes.map((type) => competitorLabel(language, type)).join(', ')}</p>
            <p>{tr(language, hasCustomerCepData ? 'Os bairros de clientes deste relatório vêm da planilha de CEPs enviada.' : 'Nenhuma planilha de CEPs foi enviada; o relatório não infere bairros de clientes a partir de concorrentes.', hasCustomerCepData ? 'Customer neighborhoods in this report come from the uploaded ZIP/postal-code spreadsheet.' : 'No ZIP/postal-code spreadsheet was uploaded; the report does not infer customer neighborhoods from competitors.')}</p>
          </PrintBlock>
        </div>
      </PrintPage>

      <PrintPage>
        <h2>{tr(language, 'Mapa e gráficos da análise', 'Analysis map and charts')}</h2>
        <PrintGeoMap result={result} language={language} />
        {hasCustomerCepData && (
          <div className="print-two-columns">
            <PrintBarChart title={tr(language, 'CEPs por faixa de distância', 'ZIPs by distance range')} rows={distanceRows.length ? distanceRows : [{ label: tr(language, 'Sem planilha', 'No spreadsheet'), value: 0 }]} />
            <PrintBarChart title={tr(language, 'Bairros com mais CEPs enviados', 'Neighborhoods with most uploaded ZIPs')} rows={neighborhoodRows.length ? neighborhoodRows : [{ label: tr(language, 'Sem bairros', 'No neighborhoods'), value: 0 }]} />
          </div>
        )}
        <PrintCategoryChart result={result} language={language} />
      </PrintPage>

      <PrintPage>
        <h2>{tr(language, 'Recomendações e estatísticas', 'Recommendations and statistics')}</h2>
        <div className="print-two-columns">
          <PrintBlock title={tr(language, 'Prioridade principal', 'Main priority')}>
            <p>{recommendations.prioridadePrincipal}</p>
          </PrintBlock>
          <PrintBlock title={tr(language, 'Brecha competitiva', 'Competitive gap')}>
            <p>{recommendations.brechaCompetitiva}</p>
          </PrintBlock>
          <PrintBlock title={tr(language, 'Persona foco', 'Focus persona')}>
            <p>{recommendations.personaFoco}</p>
          </PrintBlock>
          <PrintBlock title={tr(language, 'Objeção e resposta', 'Objection and response')}>
            <p><strong>{tr(language, 'Objeção provável:', 'Likely objection:')}</strong> {recommendations.objecaoProvavel}</p>
            <p><strong>{tr(language, 'Resposta:', 'Response:')}</strong> {recommendations.respostaRecomendada}</p>
          </PrintBlock>
        </div>
        <PrintBlock title={tr(language, 'Mensagem pronta', 'Ready-to-use message')}>
          <p>{recommendations.mensagemPronta}</p>
        </PrintBlock>

        <div className="print-two-columns">
          {hasCustomerCepData && (
            <PrintBlock title={tr(language, 'Resumo de distância dos clientes', 'Customer distance summary')}>
              <p><strong>{tr(language, 'Distância média:', 'Average distance:')}</strong> {formatKm(result.estatisticas.distanciaMediaKm)}</p>
              <p><strong>{tr(language, 'Distância mediana:', 'Median distance:')}</strong> {formatKm(result.estatisticas.distanciaMedianaKm)}</p>
            </PrintBlock>
          )}
          <PrintBlock title={tr(language, 'Índice de oportunidade', 'Opportunity index')}>
            <p>{result.estatisticas.indiceOportunidadeMercado}/100</p>
          </PrintBlock>
        </div>
      </PrintPage>

      {hasCustomerCepData && (
        <PrintPage>
          <h2>{tr(language, 'Bairros de clientes e oportunidades', 'Customer neighborhoods and opportunities')}</h2>
          <p className="print-page-intro">{tr(language, 'Esta página usa somente os CEPs de clientes enviados pelo usuário. Ela não usa concorrentes como se fossem clientes.', 'This page uses only customer ZIP/postal codes uploaded by the user. It does not treat competitors as customers.')}</p>
          <div className="print-two-columns">
            <PrintBlock title={tr(language, 'Índice de afinidade por bairro de cliente', 'Customer-neighborhood affinity index')}>
              {topAffinity.map((item, index) => (
                <div key={`${item.bairro}-${item.cidade}`} className="print-ranking-item">
                  <strong>{index + 1}. {item.bairro}, {item.cidade} - {item.score}/100</strong>
                  <p>{item.acaoRecomendada}</p>
                </div>
              ))}
            </PrintBlock>
            <PrintBlock title={tr(language, 'Leitura operacional dos bairros com clientes', 'Operational reading of customer neighborhoods')}>
              {topEconomic.map((item, index) => (
                <div key={`${item.bairro}-${item.cidade}`} className="print-ranking-item">
                  <strong>{index + 1}. {item.bairro}, {item.cidade} - {item.score}/100</strong>
                  <p>{item.acaoRecomendada}</p>
                </div>
              ))}
            </PrintBlock>
          </div>
        </PrintPage>
      )}

      <PrintPage>
        <h2>{tr(language, 'Concorrentes, barreiras e posicionamento', 'Competitors, barriers, and positioning')}</h2>
        <PrintBlock title={tr(language, 'Concorrentes e locais relevantes', 'Competitors and relevant places')}>
          {topPlaces.length ? (
            <table className="print-table print-places-table">
              <thead>
                <tr>
                  <th>{tr(language, 'Local', 'Place')}</th>
                  <th>{tr(language, 'Categoria', 'Category')}</th>
                  <th>{tr(language, 'Distância', 'Distance')}</th>
                  <th>{tr(language, 'Avaliação', 'Rating')}</th>
                </tr>
              </thead>
              <tbody>
                {topPlaces.map((place) => (
                  <tr key={`${place.nome}-${place.lat}-${place.lng}`}>
                    <td>{place.nome}</td>
                    <td>{categoryLabel(language, place.categoriaEstrategica)}</td>
                    <td>{place.distanciaKm ? formatKm(place.distanciaKm) : '-'}</td>
                    <td>{starLabel(language, place.rating, place.userRatingCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{tr(language, 'Nenhum concorrente ou local relevante foi encontrado. Consulte o diagnóstico das fontes no fim do relatório.', 'No competitor or relevant place was found. See the source diagnosis at the end of the report.')}</p>
          )}
        </PrintBlock>

        <PrintBlock title={tr(language, 'Obstáculos de conversão', 'Conversion obstacles')}>
          {result.obstaculosMatricula.length ? (
            result.obstaculosMatricula.slice(0, 6).map((item) => (
              <div key={`${item.bairro}-${item.tipoObstaculo}`} className="print-ranking-item">
                <strong>{item.bairro} - {item.tipoObstaculo} ({item.impactoEstimado})</strong>
                <p>{item.descricao}</p>
                <p><strong>{tr(language, 'Ação:', 'Action:')}</strong> {item.acaoRecomendada}</p>
              </div>
            ))
          ) : (
            <p>{tr(language, 'Nenhum obstáculo relevante foi identificado.', 'No relevant obstacle was identified.')}</p>
          )}
        </PrintBlock>
      </PrintPage>

      <PrintPage>
        <h2>{tr(language, 'SWOT e plano de ação', 'SWOT and action plan')}</h2>
        <div className="print-swot">
          <PrintBlock title={tr(language, 'Forças', 'Strengths')}>
            <PrintList items={position.forcasAtuais} limit={4} />
          </PrintBlock>
          <PrintBlock title={tr(language, 'Fraquezas', 'Weaknesses')}>
            <PrintList items={position.riscosDePosicionamento} limit={4} />
          </PrintBlock>
          <PrintBlock title={tr(language, 'Oportunidades', 'Opportunities')}>
            <PrintList items={[...position.diferenciaisFrenteConcorrentes, ...position.ajustesIncrementaisSugeridos, ...position.hipotesesParaTestar]} limit={4} />
          </PrintBlock>
          <PrintBlock title={tr(language, 'Ameaças', 'Threats')}>
            <PrintList items={result.obstaculosMatricula.map((item) => `${item.tipoObstaculo} em ${item.bairro}: ${item.acaoRecomendada}`)} limit={4} />
          </PrintBlock>
        </div>

        <PrintBlock title={tr(language, 'Plano de ação', 'Action plan')}>
          {result.planoDeAcao.slice(0, 6).map((item) => (
            <div key={item.prioridade} className="print-action-item">
              <strong>{item.prioridade}. {item.acao}</strong>
              <p>{simpleLabel(language, item.tipo)} | {tr(language, 'Impacto', 'Impact')} {simpleLabel(language, item.impactoEsperado)} | {tr(language, 'Execução', 'Execution')} {simpleLabel(language, item.facilidadeExecucao)} | {tr(language, 'Prazo', 'Timeline')} {item.prazoSugerido}</p>
              <p><strong>KPI:</strong> {item.kpiParaMedirSucesso}</p>
            </div>
          ))}
        </PrintBlock>
      </PrintPage>

      <PrintPage>
        <h2>{tr(language, 'Canvas do modelo de negócio', 'Business model canvas')}</h2>
        <p className="print-page-intro">{tr(language, 'Síntese aplicada do modelo de negócio sugerido pela análise, considerando escopo informado, região, concorrentes, canais e possíveis parcerias.', 'Applied summary of the business model suggested by the analysis, considering the stated scope, region, competitors, channels, and possible partnerships.')}</p>
        <div className="print-canvas-grid">
          {canvasBlocks.map((block) => (
            <PrintBlock key={block.key} title={block.title}>
              <PrintList items={businessModelCanvas[block.key]} limit={4} />
            </PrintBlock>
          ))}
        </div>
      </PrintPage>

      <PrintPage>
        <h2>{tr(language, 'Personas, evolução e fontes', 'Personas, evolution, and sources')}</h2>
        <div className="print-two-columns">
          <PrintBlock title={tr(language, 'Personas principais', 'Main personas')}>
            {result.personas.slice(0, 4).map((persona) => (
              <div key={persona.nomeFicticio} className="print-ranking-item">
                <strong>{persona.nomeFicticio}</strong>
                <p>{valueOrDash(persona.perfilComprador || persona.perfilFamiliar)}</p>
                <p>{persona.mensagemRecomendada}</p>
              </div>
            ))}
          </PrintBlock>
          <PrintBlock title={tr(language, 'Evolução incremental', 'Incremental evolution')}>
            <p><strong>{tr(language, 'Manter:', 'Keep:')}</strong></p>
            <PrintList items={result.evolucaoIncremental.manter} limit={3} />
            <p><strong>{tr(language, 'Melhorar:', 'Improve:')}</strong></p>
            <PrintList items={result.evolucaoIncremental.melhorar} limit={3} />
            <p><strong>{tr(language, 'Adicionar:', 'Add:')}</strong></p>
            <PrintList items={result.evolucaoIncremental.adicionar} limit={3} />
          </PrintBlock>
        </div>
        <PrintBlock title={tr(language, 'Diagnóstico das fontes públicas', 'Public source diagnosis')}>
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
