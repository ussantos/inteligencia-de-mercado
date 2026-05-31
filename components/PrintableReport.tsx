'use client';

// Este componente monta uma versao do relatorio feita so para impressao.
// A tela interativa continua existindo, mas o navegador imprime esta estrutura compacta em A4 retrato.
import type { AnalysisResult } from '@/lib/types';
import type { ReactNode } from 'react';
import { formatKm } from '@/lib/utils';

function starLabel(rating?: number | null, count?: number | null) {
  if (!rating) return 'Sem avaliacao Google';
  return `${rating.toFixed(1)} (${count || 0} avaliacoes)`;
}

function valueOrDash(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
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
  const topPlaces = result.strategicPlaces.slice(0, 12);
  const topAffinity = result.afinidadePorBairro.slice(0, 6);
  const topEconomic = result.perfilEconomico.slice(0, 6);

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
            <p><strong>CNAEs usados:</strong> {result.selectedCnaes.map((cnae) => cnae.descricao).join(' | ')}</p>
            {result.businessActivityDescription && <p><strong>Descricao informada:</strong> {result.businessActivityDescription}</p>}
            <p><strong>Tipos de concorrentes:</strong> {result.competitorTypes.join(', ')}</p>
          </PrintBlock>
        </div>
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
          <PrintBlock title="CEPs por faixa de distancia">
            <table className="print-table">
              <tbody>
                {result.estatisticas.distribuicaoDistancias.map((item) => (
                  <tr key={item.faixa}>
                    <th>{item.faixa}</th>
                    <td>{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintBlock>
          <PrintBlock title="Bairros com mais CEPs enviados">
            <table className="print-table">
              <tbody>
                {result.estatisticas.topBairros.slice(0, 8).map((item) => (
                  <tr key={`${item.bairro}-${item.cidade}`}>
                    <th>{item.bairro}, {item.cidade}</th>
                    <td>{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
