// Este arquivo e o "cerebro" da analise.
// Ele junta CEPs opcionais de clientes, CNPJ, ramo informado, concorrentes, distancias e regras simples para montar o relatorio final.
// Pense nele como uma cozinha: recebe varios ingredientes e devolve um prato organizado.
import { prisma } from '@/lib/prisma';
import { normalizeCep, isValidCep } from '@/lib/cep';
import { clamp } from '@/lib/utils';
import { getDistance } from '@/services/distance';
import { geocodeAddress, geocodeCep } from '@/services/geocode';
import { getStrategicPlaces } from '@/services/google-places';
import { enhanceWithOpenAI } from '@/services/ai';
import { DEFAULT_COMPETITOR_TYPES, type CompetitorType } from '@/lib/competitor-types';
import type { AnalysisResult, BusinessModelCanvas, CepPoint, CnaeOption, NeighborhoodScore, Persona, StrategicPlace, UnidadeNegocio } from '@/lib/types';

function median(values: number[]) {
  // Mediana e o numero que fica no meio da lista ordenada.
  // Ela evita que um valor muito fora do normal bagunce a leitura das distancias.
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function placeNeighborhood(place: StrategicPlace, fallback: { bairro: string; cidade: string }) {
  return {
    bairro: place.bairro || fallback.bairro,
    cidade: fallback.cidade
  };
}

function groupByNeighborhood(params: {
  points: CepPoint[];
  places: StrategicPlace[];
  unidade: UnidadeNegocio;
  unitLat: number;
  unitLng: number;
  radiusKm: number;
}): NeighborhoodScore[] {
  // Aqui agrupamos somente CEPs de clientes enviados pelo usuario.
  // Concorrentes do Google nao entram nesta pontuacao, porque concorrencia nao e base de clientes.
  if (!params.points.length) return [];

  const keys = new Map<string, { bairro: string; cidade: string; points: CepPoint[] }>();

  for (const point of params.points) {
    const key = `${point.bairro}||${point.cidade}`;
    const current = keys.get(key) || { bairro: point.bairro, cidade: point.cidade, points: [] };
    current.points.push(point);
    keys.set(key, current);
  }

  return [...keys.values()].map((group) => {
    const nearbyPlaces = params.places.filter((place) => {
      const neighborhood = placeNeighborhood(place, { bairro: params.unidade.bairro, cidade: params.unidade.municipio });
      return neighborhood.bairro === group.bairro;
    });
    const direct = nearbyPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente direto' || place.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
    const indirect = nearbyPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente indireto' || place.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
    const barriers = nearbyPlaces.filter((place) => place.categoriaEstrategica === 'Barreira de acesso ou conveniência' || place.categoriaEstrategica === 'Barreira potencial de agenda').length;
    const poles = nearbyPlaces.filter((place) => place.categoriaEstrategica === 'Polo gerador de público').length;
    const avgDistance = group.points.reduce((acc, p) => acc + p.distanciaLinhaRetaKm, 0) / group.points.length;
    const ratingBoost = Math.min(8, nearbyPlaces.reduce((acc, p) => acc + (p.rating || 0), 0) / Math.max(nearbyPlaces.length, 1));
    const score = clamp(
      55 +
        group.points.length * 8 +
        Math.max(0, 20 - avgDistance * 1.4) +
        Math.max(0, 18 - direct * 4) +
        Math.max(0, 8 - indirect * 0.8) +
        Math.min(8, poles * 2) +
        ratingBoost -
        barriers * 1.5
    );

    return {
      bairro: group.bairro,
      cidade: group.cidade,
      score: Math.round(score),
      cepCount: group.points.length,
      distanciaMediaKm: Number(avgDistance.toFixed(1)),
      concorrentesDiretos: direct,
      concorrentesIndiretos: indirect,
      polosFamiliares: poles,
      evidencias: [
        `${group.points.length} CEP(s) de clientes atuais enviados pelo usuário neste bairro.`,
        `${direct} concorrente(s) direto(s) mapeado(s) no mesmo bairro pelo Google Places.`,
        `${indirect} concorrente(s) indireto(s) mapeado(s) no mesmo bairro.`,
        `${barriers} possível(is) barreira(s) de acesso, conveniência ou decisão de compra no bairro.`
      ],
      limitacoes: [
        'Este ranking existe apenas porque houve CEPs de clientes enviados pelo usuário.',
        'As avaliações e locais vêm do Google Places e dependem da disponibilidade de dados do Google para a região.'
      ],
      acaoRecomendada: score >= 75
        ? `Priorizar campanhas e follow-up para ${group.bairro}, usando argumentos de diferenciação frente aos concorrentes locais.`
        : score >= 55
          ? `Testar uma campanha de baixo custo para ${group.bairro} antes de ampliar investimento.`
          : `Monitorar ${group.bairro} e validar manualmente demanda antes de priorizar mídia.`
    };
  }).sort((a, b) => b.score - a.score);
}

function buildDistribuicao(points: CepPoint[]) {
  const ranges = [
    { faixa: 'Até 1 km', test: (v: number) => v <= 1 },
    { faixa: '1–2 km', test: (v: number) => v > 1 && v <= 2 },
    { faixa: '2–5 km', test: (v: number) => v > 2 && v <= 5 },
    { faixa: '5–10 km', test: (v: number) => v > 5 && v <= 10 },
    { faixa: '10–20 km', test: (v: number) => v > 10 && v <= 20 },
    { faixa: '20 km+', test: (v: number) => v > 20 }
  ];
  return ranges.map((range) => ({ faixa: range.faixa, total: points.filter((point) => range.test(point.distanciaLinhaRetaKm)).length }));
}

function buildObstacles(scores: NeighborhoodScore[], places: StrategicPlace[], radiusKm: number): AnalysisResult['obstaculosMatricula'] {
  // Obstaculos sao coisas que podem dificultar a venda.
  // Exemplo: muitos concorrentes diretos, muita alternativa indireta ou distancia alta.
  if (!scores.length) {
    const direct = places.filter((place) => place.categoriaEstrategica === 'Concorrente direto' || place.categoriaEstrategica === 'Concorrente direto de tecnologia');
    const indirect = places.filter((place) => place.categoriaEstrategica === 'Concorrente indireto' || place.categoriaEstrategica === 'Concorrente indireto extracurricular');
    const barriers = places.filter((place) => place.categoriaEstrategica === 'Barreira de acesso ou conveniência' || place.categoriaEstrategica === 'Barreira potencial de agenda');
    const items: AnalysisResult['obstaculosMatricula'] = [];

    if (direct.length) {
      items.push({
        bairro: 'Raio analisado',
        tipoObstaculo: 'Concorrência direta no entorno',
        descricao: `Foram encontrados concorrentes diretos dentro do raio de ${radiusKm} km. Como não há CEPs de clientes, isso deve ser lido como pressão competitiva regional, não como bairro de clientes.`,
        evidencias: direct.slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: direct.length >= 8 ? 'Alto' : direct.length >= 3 ? 'Médio' : 'Baixo',
        acaoRecomendada: 'Compare proposta, reputação, preço percebido, velocidade de resposta e prova social dos concorrentes antes de criar a mensagem comercial.',
        deveSerTestadoAntes: true
      });
    }

    if (indirect.length >= 3) {
      items.push({
        bairro: 'Raio analisado',
        tipoObstaculo: 'Alternativas indiretas no entorno',
        descricao: 'Há alternativas que podem disputar atenção, orçamento ou conveniência do mesmo público, ainda que não sejam concorrentes diretos.',
        evidencias: indirect.slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: 'Médio',
        acaoRecomendada: 'Explique por que a empresa resolve melhor o problema do cliente do que alternativas indiretas, usando exemplos concretos e linguagem simples.',
        deveSerTestadoAntes: true
      });
    }

    if (barriers.length) {
      items.push({
        bairro: 'Raio analisado',
        tipoObstaculo: 'Barreiras de acesso ou conveniência',
        descricao: 'Foram encontrados fatores regionais que podem interferir na decisão de compra, como acesso, conveniência, fluxo ou comparação com polos próximos.',
        evidencias: barriers.slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: barriers.length >= 4 ? 'Médio' : 'Baixo',
        acaoRecomendada: 'Valide no atendimento quais barreiras aparecem de verdade: distância, agenda, estacionamento, preço, confiança ou prazo.',
        deveSerTestadoAntes: true
      });
    }

    return items;
  }

  return scores.slice(0, 8).flatMap((score) => {
    const relatedPlaces = places.filter((place) => (place.bairro || score.bairro) === score.bairro || !place.bairro);
    const direct = score.concorrentesDiretos;
    const indirect = score.concorrentesIndiretos;
    const barriers = relatedPlaces.filter((place) => place.categoriaEstrategica === 'Barreira de acesso ou conveniência' || place.categoriaEstrategica === 'Barreira potencial de agenda');
    const items: AnalysisResult['obstaculosMatricula'] = [];
    if (direct > 0) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Concorrência direta',
        descricao: 'Há concorrentes com proposta próxima ao segmento analisado no raio definido.',
        evidencias: relatedPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente direto' || place.categoriaEstrategica === 'Concorrente direto de tecnologia').slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: direct >= 4 ? 'Alto' : 'Médio',
        acaoRecomendada: `Comparar a proposta da empresa com os concorrentes locais e destacar diferenciais reais de preço, qualidade, conveniência, reputação e atendimento.`,
        deveSerTestadoAntes: true
      });
    }
    if (indirect >= 3) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Disputa por alternativas de compra',
        descricao: 'Ofertas substitutas ou indiretas podem capturar orçamento, atenção e conveniência do mesmo público.',
        evidencias: relatedPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente indireto' || place.categoriaEstrategica === 'Concorrente indireto extracurricular').slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: 'Médio',
        acaoRecomendada: 'Explicitar quando a oferta é melhor escolha que alternativas indiretas, usando benefícios objetivos e provas locais.',
        deveSerTestadoAntes: true
      });
    }
    if (score.distanciaMediaKm > radiusKm * 0.75) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Distância dentro do raio analisado',
        descricao: 'A distância média pode tornar a ida semanal mais difícil para famílias com rotina escolar intensa.',
        evidencias: [`Distância média estimada: ${score.distanciaMediaKm} km no raio de ${radiusKm} km.`],
        impactoEstimado: 'Médio',
        acaoRecomendada: 'Testar horários concentrados, workshops pontuais ou campanhas por bairro antes de ampliar investimento contínuo.',
        deveSerTestadoAntes: true
      });
    }
    if (barriers.length) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Possível barreira de acesso ou conveniência',
        descricao: 'Foram identificados locais ou condições regionais que podem afetar fluxo, conveniência, comparação ou decisão de compra.',
        evidencias: barriers.slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: barriers.length >= 4 ? 'Médio' : 'Baixo',
        acaoRecomendada: 'Validar com clientes reais quais fatores pesam mais na decisão: preço, acesso, prazo, confiança, disponibilidade ou conveniência.',
        deveSerTestadoAntes: true
      });
    }
    return items;
  });
}

function persona(input: {
  nome: string;
  decisor: string;
  perfil: string;
  motivacoes: string[];
  dores: string[];
  canais: string[];
  gatilhos: string[];
  mensagem: string;
}): Persona {
  return {
    nomeFicticio: input.nome,
    idade: input.decisor,
    decisorPrincipal: input.decisor,
    perfilComprador: input.perfil,
    papelNaDecisao: 'Decisor ou influenciador relevante para a compra.',
    filhoIdade: 'Não se aplica',
    filhoPerfil: input.perfil,
    papelDoFilhoNaDecisao: 'Não se aplica ao modelo genérico de negócio.',
    perfilFamiliar: input.perfil,
    classeAbepEstimativa: 'A definir com dados reais de ticket, recorrência e origem dos clientes.',
    motivacoes: input.motivacoes,
    doresEObjecoes: input.dores,
    canaisPreferidos: input.canais,
    disponibilidadeDeCompra: 'Depende de urgência, confiança, conveniência, preço percebido e prova social local.',
    gatilhosDeDecisao: input.gatilhos,
    mensagemRecomendada: input.mensagem
  };
}

function buildPersonas(unidade: UnidadeNegocio, topBairro: string, analysisSegment?: string): Persona[] {
  // Personas sao personagens ficticios que representam tipos de clientes.
  // Elas ajudam marketing e atendimento a imaginar melhor para quem estao falando.
  const segment = analysisSegment || unidade.cnaePrincipalDescricao || 'segmento analisado';
  return [
    persona({
      nome: 'Cliente de proximidade',
      decisor: 'Morador ou comprador frequente da região',
      perfil: `Busca uma opção confiável de ${segment} perto de ${topBairro}, com atendimento rápido e boa reputação local.`,
      motivacoes: ['Conveniência', 'Confiança no atendimento', 'Boa relação custo-benefício'],
      dores: ['Pouco tempo para comparar opções', 'Receio de atendimento ruim', 'Sensibilidade a preço e prazo'],
      canais: ['Google', 'WhatsApp', 'Indicação local'],
      gatilhos: ['Avaliações positivas', 'Resposta rápida', 'Localização conveniente'],
      mensagem: `Uma opção confiável de ${segment} perto de você, com atendimento claro e solução sem complicação.`
    }),
    persona({
      nome: 'Comprador comparador',
      decisor: 'Pessoa que pesquisa antes de comprar',
      perfil: `Compara concorrentes de ${segment}, avaliações, preço, qualidade percebida e provas de resultado antes de decidir.`,
      motivacoes: ['Reduzir risco de escolha', 'Encontrar melhor valor percebido', 'Ver evidências antes do contato'],
      dores: ['Informação incompleta', 'Promessas genéricas', 'Dúvida entre opções parecidas'],
      canais: ['Google', 'Instagram', 'Sites de avaliação'],
      gatilhos: ['Prova social', 'Portfólio ou casos reais', 'Oferta bem explicada'],
      mensagem: 'Compare com segurança: veja diferenciais, avaliações e o que torna a oferta mais adequada para sua necessidade.'
    }),
    persona({
      nome: 'Cliente com urgência',
      decisor: 'Comprador orientado por prazo',
      perfil: `Precisa resolver uma demanda de ${segment} rapidamente e tende a escolher quem responde primeiro com clareza.`,
      motivacoes: ['Rapidez', 'Disponibilidade', 'Baixo atrito no contato'],
      dores: ['Demora no retorno', 'Falta de agenda ou estoque', 'Processo de compra confuso'],
      canais: ['WhatsApp', 'Google Maps', 'Telefone'],
      gatilhos: ['Chamada direta', 'Confirmação de disponibilidade', 'Orçamento simples'],
      mensagem: 'Atendimento ágil para resolver sua necessidade hoje, com clareza de preço, prazo e próximos passos.'
    }),
    persona({
      nome: 'Parceiro ou influenciador local',
      decisor: 'Empresa, profissional ou liderança regional',
      perfil: `Pode indicar clientes ou formar parceria complementar no entorno de ${topBairro}.`,
      motivacoes: ['Ganhar relevância local', 'Gerar indicações mútuas', 'Criar ofertas combinadas'],
      dores: ['Falta de parceiros confiáveis', 'Pouco tempo para ações locais', 'Dificuldade de mensurar retorno'],
      canais: ['Networking local', 'LinkedIn', 'WhatsApp'],
      gatilhos: ['Proposta de parceria simples', 'Benefício mútuo', 'Ação piloto de baixo risco'],
      mensagem: 'Vamos testar uma parceria local simples, com indicação mútua e medição objetiva de retorno.'
    })
  ];
}

async function resolveUnitGeo(unidade: UnidadeNegocio) {
  // Quando a pessoa informou CNPJ, o CEP costuma ser suficiente.
  // Quando ela esta apenas estudando um novo negocio, usamos o endereco digitado manualmente.
  const cepGeo = await geocodeCep(unidade.cep);
  if (cepGeo) return cepGeo;

  const address = [unidade.logradouro, unidade.numero, unidade.bairro, unidade.municipio, unidade.uf].filter(Boolean).join(', ');
  return geocodeAddress({
    address,
    cep: unidade.cep,
    bairro: unidade.bairro,
    cidade: unidade.municipio,
    uf: unidade.uf
  });
}

function buildSmartRecommendations(input: {
  unitName: string;
  topBairro: string;
  strategicPlaces: StrategicPlace[];
  directCount: number;
  analysisRadiusKm: number;
  hasCustomerCepData: boolean;
}) {
  // Este resumo e propositalmente curto.
  // Ele transforma os dados em decisao pratica, sem criar mais uma lista de tarefas para a pessoa.
  const strongestCompetitor = input.strategicPlaces
    .filter((place) => place.categoriaEstrategica.includes('Concorrente'))
    .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0) || (b.rating || 0) - (a.rating || 0))[0];
  const competitorHint = strongestCompetitor
    ? `${strongestCompetitor.nome}${strongestCompetitor.rating ? `, avaliado com ${strongestCompetitor.rating.toFixed(1)} no Google` : ''}`
    : 'os concorrentes locais ainda precisam ser validados manualmente';

  return {
    prioridadePrincipal: input.hasCustomerCepData
      ? `Concentre a primeira rodada comercial em ${input.topBairro}, usando uma oferta clara e fácil de comparar.`
      : `Concentre a primeira rodada no raio de ${input.analysisRadiusKm} km ao redor da empresa, sem assumir bairros de clientes até haver CEPs ou leads reais.`,
    brechaCompetitiva: input.directCount > 0
      ? `Use conveniência, atendimento rápido e prova social local para competir contra ${competitorHint}.`
      : `A baixa presença de concorrentes diretos no raio de ${input.analysisRadiusKm} km sugere espaço para testar presença local antes de ampliar investimento.`,
    personaFoco: `Priorize decisores que valorizam solução próxima, resposta rápida e segurança antes de comparar apenas preço.`,
    objecaoProvavel: 'A objeção mais provável é comparar preço ou reputação com alternativas já conhecidas.',
    respostaRecomendada: 'Responda mostrando diferencial concreto, prazo, facilidade de atendimento, prova social e próximo passo simples.',
    mensagemPronta: `Olá! A ${input.unitName} atende sua região com foco em solução prática, orientação clara e resposta rápida. Posso te mostrar a melhor opção para o que você precisa hoje?`
  };
}

function uniqueFilled(values: Array<string | null | undefined>, limit = 4) {
  // Remove textos vazios e repetidos para o Canvas ficar curto e facil de ler.
  const seen = new Set<string>();
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function buildBusinessModelCanvas(input: {
  unitName: string;
  analysisSegment: string;
  topBairro: string;
  analysisRadiusKm: number;
  strategicPlaces: StrategicPlace[];
  neighborhoodScores: NeighborhoodScore[];
  directCount: number;
  competitorTypes: CompetitorType[];
  hasCustomerCepData: boolean;
}): BusinessModelCanvas {
  // O Canvas resume o modelo de negocio sugerido pela analise.
  // Ele nao pede trabalho extra ao usuario: transforma os dados ja coletados em uma visao executiva.
  const partnerPlaces = input.strategicPlaces.filter((place) => place.categoriaEstrategica === 'Oportunidade de parceria' || place.categoriaEstrategica === 'Polo gerador de público');
  const topNeighborhoods = input.neighborhoodScores.slice(0, 3).map((score) => score.bairro);
  const selectedTypeSummary = input.competitorTypes.join(', ');
  const strongCompetitor = input.strategicPlaces
    .filter((place) => place.categoriaEstrategica.toLowerCase().includes('concorrente'))
    .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0) || (b.rating || 0) - (a.rating || 0))[0];
  const competitorReference = strongCompetitor
    ? `comparação clara contra ${strongCompetitor.nome}${strongCompetitor.rating ? ` (${strongCompetitor.rating.toFixed(1)} no Google)` : ''}`
    : 'comparação objetiva contra alternativas locais';

  return {
    propostaDeValor: uniqueFilled([
      `${input.unitName} pode comunicar uma solução local de ${input.analysisSegment} com atendimento claro, resposta rápida e conveniência para ${input.topBairro}.`,
      `Diferenciação por prova social, qualidade percebida e ${competitorReference}.`,
      input.directCount > 0
        ? `Oferta explicada de forma simples para reduzir comparação apenas por preço em um raio de ${input.analysisRadiusKm} km.`
        : `Presença local em um raio de ${input.analysisRadiusKm} km onde a baixa concorrência direta pode permitir validação rápida.`
    ]),
    segmentosDeClientes: uniqueFilled([
      input.hasCustomerCepData ? `Clientes e decisores próximos de ${input.topBairro}.` : `Clientes potenciais no raio de ${input.analysisRadiusKm} km ao redor da empresa.`,
      ...(input.hasCustomerCepData ? topNeighborhoods.map((bairro) => `Público com afinidade operacional em ${bairro}.`) : []),
      'Compradores que pesquisam no Google antes de entrar em contato.',
      'Clientes com urgência que valorizam resposta rápida, prazo claro e baixo atrito.'
    ]),
    canais: uniqueFilled([
      'Google Maps e busca orgânica local.',
      'WhatsApp ou canal direto de atendimento.',
      input.hasCustomerCepData ? 'Campanhas por raio nos bairros com maior afinidade.' : `Campanhas por raio de ${input.analysisRadiusKm} km até formar base real de CEPs/leads.`,
      partnerPlaces.length ? 'Parcerias e indicações com locais complementares mapeados.' : 'Indicações locais e prova social em canais digitais.'
    ]),
    relacionamentoComClientes: uniqueFilled([
      'Atendimento consultivo com próximo passo simples.',
      'Resposta rápida para dúvidas de preço, prazo, disponibilidade e diferenciais.',
      'Follow-up segmentado por bairro, origem do lead e objeção registrada.',
      'Uso de avaliações, depoimentos e casos reais para reduzir risco percebido.'
    ]),
    fontesDeReceita: uniqueFilled([
      `Venda direta de ${input.analysisSegment}.`,
      'Pacotes, planos, recorrência ou contratos quando fizer sentido para o negócio.',
      'Upsell ou serviços complementares após a primeira compra.',
      'Receita por parcerias, indicações ou ações conjuntas quando houver parceiros locais.'
    ]),
    recursosChave: uniqueFilled([
      'Equipe ou responsável por atendimento rápido e registro de objeções.',
      'Perfil Google bem cuidado, com fotos, descrição, avaliações e dados corretos.',
      'Argumentos comerciais comparando diferenciais reais frente aos concorrentes.',
      'Base simples de leads por bairro, canal e etapa do funil.'
    ]),
    atividadesChave: uniqueFilled([
      'Monitorar concorrentes e avaliações no raio definido.',
      selectedTypeSummary ? `Revisar resultados ligados a ${selectedTypeSummary} para manter o escopo fiel ao que o usuário escolheu.` : undefined,
      'Testar mensagens locais por bairro e tipo de concorrente selecionado.',
      'Medir leads, respostas, orçamentos e conversões por origem.',
      'Atualizar argumentos comerciais conforme objeções reais do atendimento.'
    ]),
    parceriasChave: uniqueFilled([
      ...partnerPlaces.slice(0, 3).map((place) => `${place.nome} como possível parceiro ou polo de público.`),
      partnerPlaces.length ? 'Ações conjuntas com locais que concentram público compatível.' : 'Negócios complementares da região para indicação mútua.',
      'Fornecedores, influenciadores locais ou canais comunitários com acesso ao público-alvo.'
    ]),
    estruturaDeCustos: uniqueFilled([
      'Mídia local de baixo orçamento para testar bairros antes de ampliar verba.',
      'Tempo de atendimento, follow-up e organização de leads.',
      'Produção de provas comerciais: fotos, depoimentos, páginas, mensagens e materiais.',
      'Ferramentas de operação, CRM simples ou automações leves para manter consistência.'
    ])
  };
}

export async function runMarketAnalysis(input: {
  userId: string;
  unidade: UnidadeNegocio;
  ceps?: string[];
  businessActivityDescription?: string;
  competitorTypes?: CompetitorType[];
  analysisRadiusKm?: number;
}): Promise<AnalysisResult> {
  // Esta e a funcao principal.
  // Ela valida CEPs, geocodifica enderecos, busca concorrentes, calcula rankings e salva tudo no banco.
  const rawCeps = Array.isArray(input.ceps) ? input.ceps : [];
  const validCeps = [...new Set(rawCeps.map(normalizeCep).filter(isValidCep))];
  const invalidCeps = rawCeps.map(String).filter((cep) => cep.trim() && !isValidCep(cep));
  const analysisRadiusKm = Math.max(1, Math.min(20, Number(input.analysisRadiusKm || 4)));
  const businessActivityDescription = String(input.businessActivityDescription || '').trim().slice(0, 300);
  if (businessActivityDescription.length < 3) throw new Error('Descreva o ramo de atividade antes de iniciar a análise.');
  const selectedCnaes: CnaeOption[] = [];
  const competitorTypes = input.competitorTypes?.length ? input.competitorTypes : DEFAULT_COMPETITOR_TYPES;
  const domain = `Ramo informado: ${businessActivityDescription}`;

  const unitGeo = await resolveUnitGeo(input.unidade);
  if (!unitGeo) throw new Error('Não foi possível localizar o endereço informado. Revise CEP, bairro, cidade e UF.');

  const points: CepPoint[] = [];
  for (const cep of validCeps.slice(0, 500)) {
    const geo = await geocodeCep(cep);
    if (!geo) {
      invalidCeps.push(cep);
      continue;
    }
    const dist = await getDistance({ cep: unitGeo.cep, lat: unitGeo.lat, lng: unitGeo.lng }, { cep: geo.cep, lat: geo.lat, lng: geo.lng });
    points.push({
      cep: geo.cep,
      lat: geo.lat,
      lng: geo.lng,
      bairro: geo.bairro,
      cidade: geo.cidade,
      uf: geo.uf,
      endereco: geo.address,
      distanciaLinhaRetaKm: Number(dist.linhaRetaKm.toFixed(2)),
      distanciaCarroKm: dist.carroKm ? Number(dist.carroKm.toFixed(2)) : null,
      tempoMin: dist.tempoMin ? Number(dist.tempoMin.toFixed(0)) : null
    });
  }

  const strategicPlacesResult = await getStrategicPlaces({
    center: { lat: unitGeo.lat, lng: unitGeo.lng, cep: unitGeo.cep },
    unidade: input.unidade,
    competitorTypes,
    businessActivityDescription,
    radiusKm: analysisRadiusKm
  });
  const strategicPlaces = strategicPlacesResult.places;
  const neighborhoodScores = groupByNeighborhood({ points, places: strategicPlaces, unidade: input.unidade, unitLat: unitGeo.lat, unitLng: unitGeo.lng, radiusKm: analysisRadiusKm });
  const hasCustomerCepData = points.length > 0;
  const distances = points.map((p) => p.distanciaLinhaRetaKm);
  const directCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente direto' || p.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
  const indirectCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente indireto' || p.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
  const opportunity = clamp(68 + (hasCustomerCepData ? Math.min(20, points.length * 1.5) : 0) - directCount * 3.5 - indirectCount * 0.7 + (neighborhoodScores[0]?.score || 0) / 4);
  const fase = directCount <= 2 ? 'Mercado com Lacuna' : directCount <= 8 ? 'Mercado em Crescimento' : directCount <= 18 ? 'Mercado Maduro' : 'Mercado Saturado';

  const topBairros = neighborhoodScores.slice(0, 5).map((item) => ({ bairro: item.bairro, cidade: item.cidade, total: item.cepCount }));
  const today = new Date();
  const reviewDays = fase === 'Mercado com Lacuna' ? 30 : fase === 'Mercado em Crescimento' ? 60 : fase === 'Mercado Maduro' ? 90 : 45;
  const unitName = input.unidade.nomeFantasia || input.unidade.razaoSocial;
  const topBairro = neighborhoodScores[0]?.bairro || input.unidade.bairro;
  const analysisSegment = businessActivityDescription;
  const hasGoogleKey = Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY);

  const result: AnalysisResult = {
    createdAt: today.toISOString(),
    domain,
    selectedCnaes,
    businessActivityDescription: businessActivityDescription || undefined,
    competitorTypes,
    analysisRadiusKm,
    unidade: input.unidade,
    unidadeGeo: { lat: unitGeo.lat, lng: unitGeo.lng, endereco: unitGeo.address },
    points,
    invalidCeps,
    strategicPlaces,
    faseMercadoLocal: {
      fase: fase as any,
      justificativa: hasCustomerCepData
        ? `Classificação baseada no ramo informado, no raio de ${analysisRadiusKm} km ao redor da empresa, em ${points.length} CEP(s) de clientes enviados e em ${directCount} concorrente(s) direto(s) e ${indirectCount} concorrente(s) indireto(s) mapeados via Google Places.`
        : `Classificação baseada no ramo informado, no raio de ${analysisRadiusKm} km ao redor da empresa e em ${directCount} concorrente(s) direto(s) e ${indirectCount} concorrente(s) indireto(s) mapeados via Google Places. Nenhuma seção de afinidade de clientes foi gerada porque não houve upload de CEPs de clientes.`,
      cor: fase === 'Mercado Saturado' ? 'vermelho' : fase === 'Mercado Maduro' ? 'laranja' : fase === 'Mercado em Crescimento' ? 'amarelo' : 'verde'
    },
    estatisticas: {
      totalEnviados: rawCeps.length,
      totalValidos: points.length,
      totalInvalidos: invalidCeps.length,
      distanciaMediaKm: distances.length ? Number((distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1)) : 0,
      distanciaMedianaKm: Number(median(distances).toFixed(1)),
      topBairros,
      distribuicaoDistancias: buildDistribuicao(points),
      indiceOportunidadeMercado: Math.round(opportunity)
    },
    perfilEconomico: neighborhoodScores,
    afinidadePorBairro: neighborhoodScores,
    obstaculosMatricula: buildObstacles(neighborhoodScores, strategicPlaces, analysisRadiusKm),
    posicionamentoUnidade: {
      forcasAtuais: [
        `${unitName} atua no contexto de ${input.unidade.bairro}, ${input.unidade.municipio}/${input.unidade.uf}, com escopo definido pelo ramo informado: ${businessActivityDescription}.`,
        'A análise considera a região real da empresa detectada pelo CNPJ, e não um território genérico.',
        'Atendimento consultivo, prova social, clareza de oferta e conveniência local são ativos importantes para conversão.'
      ],
      diferenciaisFrenteConcorrentes: [
        `Frente aos concorrentes mapeados em até ${analysisRadiusKm} km, a empresa deve destacar qualidade, reputação, conveniência, preço percebido e velocidade de atendimento.`,
        'Quando competir com alternativas indiretas, posicionar a oferta pelo problema que resolve melhor e não apenas pela categoria do serviço.',
        'Quando competir com redes ou negócios bem avaliados, reforçar diferenciais locais, atendimento humano e provas concretas.'
      ],
      riscosDePosicionamento: [
        'Concorrentes com muitas avaliações no Google podem transmitir confiança inicial maior; usar prova social local para reduzir esse risco.',
        'Se houver muita oferta similar na região, a objeção principal pode ser diferenciação, conveniência ou preço.',
        'Clientes podem comparar preço se o atendimento não mostrar valor antes da proposta comercial.'
      ],
      mensagensRecomendadas: [
        `Para clientes de ${topBairro}: solução local confiável, com atendimento claro e resposta rápida.`,
        'Explique a oferta em termos de problema resolvido, prazo, qualidade, preço percebido e prova social.',
        'Mostre diferenciais concretos antes de pedir a decisão de compra.'
      ],
      ajustesIncrementaisSugeridos: [
        hasCustomerCepData ? `Testar campanha local em ${topBairro} e bairros próximos antes de ampliar verba.` : `Testar uma campanha por raio de ${analysisRadiusKm} km antes de segmentar bairros específicos.`,
        hasCustomerCepData ? 'Registrar objeções por bairro: distância, agenda, preço e comparação com concorrentes.' : 'Registrar objeções por origem do lead: distância, agenda, preço e comparação com concorrentes.',
        'Criar respostas comerciais citando diferenciais frente aos tipos de concorrentes selecionados.'
      ],
      hipotesesParaTestar: [
        hasCustomerCepData ? `Bairros com maior score no raio de ${analysisRadiusKm} km tendem a gerar mais leads qualificados.` : `O raio de ${analysisRadiusKm} km pode gerar demanda qualificada se a oferta deixar claro por que é melhor que os concorrentes próximos.`,
        'Mensagens com prova social e benefício concreto convertem melhor que mensagens genéricas.',
        'Clientes avançam mais rápido quando recebem preço, prazo e diferenciais de forma objetiva.'
      ]
    },
    personas: buildPersonas(input.unidade, topBairro, analysisSegment),
    evolucaoIncremental: {
      manter: ['WhatsApp ou canal direto como principal ponto de conversão.', 'Atendimento consultivo como porta de entrada.', 'Comunicação centrada no problema que o negócio resolve.'],
      melhorar: [hasCustomerCepData ? `Segmentação por bairros com clientes dentro do raio de ${analysisRadiusKm} km.` : `Segmentação inicial por raio de ${analysisRadiusKm} km, sem assumir bairros de clientes.`, 'Scripts de objeção por perfil de cliente, origem do lead e tipo de concorrente citado.', 'Mensuração de leads por origem geográfica e por concorrente citado.'],
      adicionar: [hasCustomerCepData ? 'Ranking de bairros prioritários para campanhas locais.' : 'Registro de CEP ou bairro dos novos leads para criar base real de clientes futuros.', 'Lista de concorrentes com avaliação Google para comparação comercial.', 'Campo de objeções no follow-up para validar barreiras regionais.'],
      testarAntesDeAlterar: [hasCustomerCepData ? 'Campanhas por raio nos bairros com maior afinidade.' : 'Campanhas por raio amplo antes de escolher bairros prioritários.', 'Mensagens específicas por intenção de compra e nível de urgência.', 'Ofertas pontuais para testar resposta antes de alterar preço ou operação.'],
      fazerSemPrejudicarOperacao: ['Usar os dados como camada de decisão semanal, sem trocar a operação comercial atual.', 'Aplicar testes pequenos antes de mudar investimento, preços ou formato de oferta.']
    },
    diagnosticoFontesPublicas: [
      ...strategicPlacesResult.diagnostics,
      hasGoogleKey ? 'Google Places está configurado para mapear concorrentes, avaliações, quantidade de avaliações e dados públicos dos locais no raio definido.' : 'Google Places não foi executado porque GOOGLE_MAPS_SERVER_API_KEY ou GOOGLE_PLACES_API_KEY não está configurada.',
      'ViaCEP resolve CEP para endereço/bairro/cidade, mas não traz renda.',
      'IBGE Localidades identifica município/UF, mas não traz renda por bairro.',
      'SIDRA exige tabela, variável, período, classificação e nível territorial; não é uma chamada genérica por CEP.',
      'PNAD Contínua é amostral e normalmente não oferece granularidade por bairro/CEP.',
      'Censo 2022 pode enriquecer a análise, mas exige ETL com setor censitário, malha territorial e cruzamento geográfico.'
    ],
    recomendacoesInteligentes: buildSmartRecommendations({ unitName, topBairro, strategicPlaces, directCount, analysisRadiusKm, hasCustomerCepData }),
    businessModelCanvas: buildBusinessModelCanvas({ unitName, analysisSegment, topBairro, analysisRadiusKm, strategicPlaces, neighborhoodScores, directCount, competitorTypes, hasCustomerCepData }),
    planoDeAcao: [
      {
        prioridade: 1,
        acao: hasCustomerCepData
          ? `Priorizar ${topBairro} e os demais bairros com CEPs reais de clientes: criar uma campanha pequena por raio, registrar origem do lead e comparar taxa de resposta antes de ampliar verba.`
          : `Validar demanda no raio de ${analysisRadiusKm} km sem assumir bairros de clientes: criar campanha pequena por raio, registrar CEP/bairro dos leads recebidos e revisar em 7 dias quais regiões responderam melhor.`,
        tipo: 'Testar',
        impactoEsperado: 'Alto',
        facilidadeExecucao: 'Alta',
        prazoSugerido: '7 a 14 dias',
        custoEstimado: 'Baixo',
        recursoGratuitoConfirmado: false,
        responsavelSugerido: 'Comercial/Marketing',
        kpiParaMedirSucesso: hasCustomerCepData ? 'Leads qualificados por bairro' : 'Leads qualificados por raio, bairro informado e custo por lead'
      },
      { prioridade: 2, acao: 'Criar uma matriz simples de comparação com os 5 concorrentes diretos mais fortes: anotar avaliação Google, distância, promessa principal, preço quando público, canal de contato e diferencial percebido; usar essa matriz para escrever respostas comerciais.', tipo: 'Melhorar', impactoEsperado: 'Alto', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing/Atendimento', kpiParaMedirSucesso: 'Taxa de avanço do primeiro contato para orçamento ou visita' },
      { prioridade: 3, acao: 'Registrar no atendimento, em uma planilha ou CRM simples, qual concorrente ou alternativa o cliente citou, qual objeção apareceu primeiro e qual resposta ajudou a avançar; revisar os registros semanalmente para ajustar a mensagem.', tipo: 'Adicionar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Atendimento', kpiParaMedirSucesso: 'Objeções registradas por lead e taxa de avanço por objeção' },
      { prioridade: 4, acao: 'Criar quatro versões de mensagem: urgência, comparação de preço, busca por qualidade e conveniência local; testar cada uma por uma semana em WhatsApp, anúncio local ou resposta padrão e manter apenas as que gerarem mais retorno qualificado.', tipo: 'Melhorar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '2 semanas', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing', kpiParaMedirSucesso: 'CTR, taxa de resposta e taxa de avanço por segmento de mensagem' }
    ],
    proximaRevisaoRecomendada: new Date(today.getTime() + reviewDays * 24 * 60 * 60 * 1000).toISOString(),
    iaAviso: process.env.OPENAI_API_KEY ? undefined : 'A análise com IA avançada não foi executada porque a chave OpenAI não está configurada. O relatório usa regras locais, Google Places e dados públicos disponíveis.'
  };
  const aiEnhancement = await enhanceWithOpenAI(result);
  const finalResult: AnalysisResult = aiEnhancement
    ? { ...result, ...aiEnhancement, posicionamentoUnidade: aiEnhancement.posicionamentoUnidade || result.posicionamentoUnidade, iaAviso: 'Plano de ação e recomendações enriquecidos com IA a partir do ramo informado, dados públicos, concorrentes, CEPs de clientes quando enviados e limitações encontradas.' }
    : result;

  const saved = await prisma.analysis.create({
    data: {
      userId: input.userId,
      businessUnitCep: input.unidade.cep || unitGeo.cep,
      businessUnitCnpj: input.unidade.cnpj || undefined,
      domain,
      reportJson: finalResult as any,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  await prisma.analysisHistory.create({
    data: {
      userId: input.userId,
      businessUnitCnpj: input.unidade.cnpj || 'sem-cnpj',
      businessUnitCep: input.unidade.cep || unitGeo.cep,
      businessUnitName: input.unidade.nomeFantasia || input.unidade.razaoSocial,
      businessUnitCnae: input.unidade.cnaePrincipalCodigo || 'sem-cnae',
      domain,
      cepCount: points.length,
      opportunityIndex: result.estatisticas.indiceOportunidadeMercado,
      fullReportJson: finalResult as any
    }
  });

  return { ...finalResult, id: saved.id };
}
