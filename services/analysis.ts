// Este arquivo e o "cerebro" da analise.
// Ele junta CEPs, CNPJ, CNAEs, concorrentes, distancias e regras simples para montar o relatorio final.
// Pense nele como uma cozinha: recebe varios ingredientes e devolve um prato organizado.
import { prisma } from '@/lib/prisma';
import { normalizeCep, isValidCep } from '@/lib/cep';
import { clamp } from '@/lib/utils';
import { getDistance } from '@/services/distance';
import { geocodeCep } from '@/services/geocode';
import { getStrategicPlaces } from '@/services/google-places';
import { enhanceWithOpenAI } from '@/services/ai';
import { DEFAULT_COMPETITOR_TYPES, type CompetitorType } from '@/lib/competitor-types';
import type { AnalysisResult, CepPoint, CnaeOption, NeighborhoodScore, Persona, StrategicPlace, UnidadeNegocio } from '@/lib/types';

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
  // Aqui juntamos clientes e concorrentes por bairro.
  // Depois damos uma nota para cada bairro, misturando distancia, concorrencia, polos e avaliacoes.
  const keys = new Map<string, { bairro: string; cidade: string; points: CepPoint[]; places: StrategicPlace[] }>();
  const defaultKey = `${params.unidade.bairro}||${params.unidade.municipio}`;
  keys.set(defaultKey, { bairro: params.unidade.bairro, cidade: params.unidade.municipio, points: [], places: [] });

  for (const point of params.points) {
    const key = `${point.bairro}||${point.cidade}`;
    const current = keys.get(key) || { bairro: point.bairro, cidade: point.cidade, points: [], places: [] };
    current.points.push(point);
    keys.set(key, current);
  }

  for (const place of params.places) {
    const neighborhood = placeNeighborhood(place, { bairro: params.unidade.bairro, cidade: params.unidade.municipio });
    const key = `${neighborhood.bairro}||${neighborhood.cidade}`;
    const current = keys.get(key) || { bairro: neighborhood.bairro, cidade: neighborhood.cidade, points: [], places: [] };
    current.places.push(place);
    keys.set(key, current);
  }

  return [...keys.values()].map((group) => {
    const direct = group.places.filter((place) => place.categoriaEstrategica === 'Concorrente direto' || place.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
    const indirect = group.places.filter((place) => place.categoriaEstrategica === 'Concorrente indireto' || place.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
    const barriers = group.places.filter((place) => place.categoriaEstrategica === 'Barreira de acesso ou conveniência' || place.categoriaEstrategica === 'Barreira potencial de agenda').length;
    const poles = group.places.filter((place) => place.categoriaEstrategica === 'Polo gerador de público').length;
    const avgDistance = group.points.length
      ? group.points.reduce((acc, p) => acc + p.distanciaLinhaRetaKm, 0) / group.points.length
      : group.places.length
        ? group.places.reduce((acc, p) => acc + (p.distanciaKm || params.radiusKm), 0) / group.places.length
        : 0;
    const ratingBoost = Math.min(8, group.places.reduce((acc, p) => acc + (p.rating || 0), 0) / Math.max(group.places.length, 1));
    const score = clamp(
      55 +
        group.points.length * 6 +
        Math.max(0, 20 - avgDistance * 1.4) +
        Math.max(0, 18 - direct * 4) +
        Math.max(0, 8 - indirect * 0.8) +
        Math.min(8, poles * 2) +
        ratingBoost -
        barriers * 1.5
    );

    const evidenceSource = group.points.length
      ? `${group.points.length} CEP(s) de clientes atuais no bairro.`
      : `Análise baseada no raio de ${params.radiusKm} km em torno da empresa, sem planilha de CEPs.`;

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
        evidenceSource,
        `${direct} concorrente(s) direto(s) mapeado(s) no Google Places.`,
        `${indirect} concorrente(s) indireto(s) mapeado(s).`,
        `${barriers} possível(is) barreira(s) de acesso, conveniência ou decisão de compra.`
      ],
      limitacoes: [
        'O perfil financeiro por bairro é uma estimativa operacional, não um dado censitário individual.',
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

function buildPersonas(unidade: UnidadeNegocio, topBairro: string): Persona[] {
  // Personas sao personagens ficticios que representam tipos de clientes.
  // Elas ajudam marketing e atendimento a imaginar melhor para quem estao falando.
  const segment = unidade.cnaePrincipalDescricao || 'segmento analisado';
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

export async function runMarketAnalysis(input: {
  userId: string;
  unidade: UnidadeNegocio;
  ceps?: string[];
  selectedCnaes?: CnaeOption[];
  competitorTypes?: CompetitorType[];
  analysisRadiusKm?: number;
}): Promise<AnalysisResult> {
  // Esta e a funcao principal.
  // Ela valida CEPs, geocodifica enderecos, busca concorrentes, calcula rankings e salva tudo no banco.
  const rawCeps = Array.isArray(input.ceps) ? input.ceps : [];
  const validCeps = [...new Set(rawCeps.map(normalizeCep).filter(isValidCep))];
  const invalidCeps = rawCeps.map(String).filter((cep) => cep.trim() && !isValidCep(cep));
  const analysisRadiusKm = Math.max(1, Math.min(50, Number(input.analysisRadiusKm || 8)));
  const selectedCnaes = input.selectedCnaes?.length ? input.selectedCnaes : input.unidade.cnaes.slice(0, 3);
  const competitorTypes = input.competitorTypes?.length ? input.competitorTypes : DEFAULT_COMPETITOR_TYPES;
  const domain = selectedCnaes.map((cnae) => `${cnae.codigo ? `${cnae.codigo} — ` : ''}${cnae.descricao}`).join(' | ') || input.unidade.cnaePrincipalDescricao;

  const unitGeo = await geocodeCep(input.unidade.cep);
  if (!unitGeo) throw new Error('Não foi possível geocodificar o CEP da empresa obtido pelo CNPJ.');

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

  const strategicPlaces = await getStrategicPlaces({
    center: { lat: unitGeo.lat, lng: unitGeo.lng, cep: unitGeo.cep },
    unidade: input.unidade,
    competitorTypes,
    selectedCnaes,
    radiusKm: analysisRadiusKm
  });
  const neighborhoodScores = groupByNeighborhood({ points, places: strategicPlaces, unidade: input.unidade, unitLat: unitGeo.lat, unitLng: unitGeo.lng, radiusKm: analysisRadiusKm });
  const distances = points.map((p) => p.distanciaLinhaRetaKm);
  const directCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente direto' || p.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
  const indirectCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente indireto' || p.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
  const opportunity = clamp(70 + (points.length ? points.length * 2 : 4) - directCount * 4 - indirectCount * 0.7 + (neighborhoodScores[0]?.score || 0) / 4);
  const fase = directCount <= 2 ? 'Mercado com Lacuna' : directCount <= 8 ? 'Mercado em Crescimento' : directCount <= 18 ? 'Mercado Maduro' : 'Mercado Saturado';

  const topBairros = neighborhoodScores.slice(0, 5).map((item) => ({ bairro: item.bairro, cidade: item.cidade, total: item.cepCount || item.concorrentesDiretos + item.concorrentesIndiretos }));
  const today = new Date();
  const reviewDays = fase === 'Mercado com Lacuna' ? 30 : fase === 'Mercado em Crescimento' ? 60 : fase === 'Mercado Maduro' ? 90 : 45;
  const unitName = input.unidade.nomeFantasia || input.unidade.razaoSocial;
  const topBairro = neighborhoodScores[0]?.bairro || input.unidade.bairro;
  const hasGoogleKey = Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY);

  const result: AnalysisResult = {
    createdAt: today.toISOString(),
    domain,
    selectedCnaes,
    competitorTypes,
    analysisRadiusKm,
    unidade: input.unidade,
    unidadeGeo: { lat: unitGeo.lat, lng: unitGeo.lng, endereco: unitGeo.address },
    points,
    invalidCeps,
    strategicPlaces,
    faseMercadoLocal: {
      fase: fase as any,
      justificativa: `Classificação baseada na região de atuação de ${analysisRadiusKm} km ao redor da empresa, ${points.length} CEP(s) de clientes enviados, ${directCount} concorrente(s) direto(s) e ${indirectCount} concorrente(s) indireto(s) mapeados via Google Places.`,
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
        `${unitName} atua no contexto de ${input.unidade.bairro}, ${input.unidade.municipio}/${input.unidade.uf}, com CNAE principal ${input.unidade.cnaePrincipalCodigo} — ${input.unidade.cnaePrincipalDescricao}.`,
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
        `Testar campanha local em ${topBairro} e bairros próximos antes de ampliar verba.`,
        'Registrar objeções por bairro: distância, agenda, preço e comparação com concorrentes.',
        'Criar respostas comerciais citando diferenciais frente aos tipos de concorrentes selecionados.'
      ],
      hipotesesParaTestar: [
        `Bairros com maior score no raio de ${analysisRadiusKm} km tendem a gerar mais leads qualificados.`,
        'Mensagens com prova social e benefício concreto convertem melhor que mensagens genéricas.',
        'Clientes avançam mais rápido quando recebem preço, prazo e diferenciais de forma objetiva.'
      ]
    },
    personas: buildPersonas(input.unidade, topBairro),
    evolucaoIncremental: {
      manter: ['WhatsApp ou canal direto como principal ponto de conversão.', 'Atendimento consultivo como porta de entrada.', 'Comunicação centrada no problema que o negócio resolve.'],
      melhorar: [`Segmentação por bairros dentro do raio de ${analysisRadiusKm} km.`, 'Scripts de objeção por perfil de cliente, bairro e tipo de concorrente.', 'Mensuração de leads por origem geográfica e por concorrente citado.'],
      adicionar: ['Ranking de bairros prioritários para campanhas locais.', 'Lista de concorrentes com avaliação Google para comparação comercial.', 'Campo de objeções no follow-up para validar barreiras regionais.'],
      testarAntesDeAlterar: ['Campanhas por raio nos bairros com maior afinidade.', 'Mensagens específicas por intenção de compra e nível de urgência.', 'Ofertas pontuais para bairros com maior distância da empresa.'],
      fazerSemPrejudicarOperacao: ['Usar os dados como camada de decisão semanal, sem trocar a operação comercial atual.', 'Aplicar testes pequenos antes de mudar investimento, preços ou formato de oferta.']
    },
    diagnosticoFontesPublicas: [
      hasGoogleKey ? 'Google Places foi usado para mapear concorrentes, avaliações, quantidade de avaliações e dados públicos dos locais no raio definido.' : 'Google Places não foi executado porque GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_SERVER_API_KEY não está configurada.',
      'ViaCEP resolve CEP para endereço/bairro/cidade, mas não traz renda.',
      'IBGE Localidades identifica município/UF, mas não traz renda por bairro.',
      'SIDRA exige tabela, variável, período, classificação e nível territorial; não é uma chamada genérica por CEP.',
      'PNAD Contínua é amostral e normalmente não oferece granularidade por bairro/CEP.',
      'Censo 2022 pode enriquecer a análise, mas exige ETL com setor censitário, malha territorial e cruzamento geográfico.'
    ],
    planoDeAcao: [
      { prioridade: 1, acao: `Priorizar os bairros com maior afinidade dentro de ${analysisRadiusKm} km para campanhas e follow-up ativo.`, tipo: 'Testar', impactoEsperado: 'Alto', facilidadeExecucao: 'Alta', prazoSugerido: '7 a 14 dias', custoEstimado: 'Baixo', recursoGratuitoConfirmado: false, responsavelSugerido: 'Comercial/Marketing', kpiParaMedirSucesso: 'Leads qualificados por bairro' },
      { prioridade: 2, acao: 'Criar argumento comercial comparando a empresa com os concorrentes diretos mais bem avaliados no Google.', tipo: 'Melhorar', impactoEsperado: 'Alto', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing/Atendimento', kpiParaMedirSucesso: 'Taxa de avanço do primeiro contato para orçamento ou visita' },
      { prioridade: 3, acao: 'Registrar no atendimento quais alternativas o cliente está comparando e qual objeção pesa mais.', tipo: 'Adicionar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Atendimento', kpiParaMedirSucesso: 'Objeções registradas por lead e bairro' },
      { prioridade: 4, acao: 'Criar mensagens diferentes para urgência, comparação de preço, busca por qualidade e conveniência local.', tipo: 'Melhorar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '2 semanas', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing', kpiParaMedirSucesso: 'CTR e taxa de resposta por segmento de mensagem' }
    ],
    proximaRevisaoRecomendada: new Date(today.getTime() + reviewDays * 24 * 60 * 60 * 1000).toISOString(),
    iaAviso: process.env.OPENAI_API_KEY ? undefined : 'A análise com IA avançada não foi executada porque a chave OpenAI não está configurada. O relatório usa regras locais, Google Places e dados públicos disponíveis.'
  };
  const aiEnhancement = await enhanceWithOpenAI(result);
  const finalResult: AnalysisResult = aiEnhancement
    ? { ...result, ...aiEnhancement, posicionamentoUnidade: aiEnhancement.posicionamentoUnidade || result.posicionamentoUnidade, iaAviso: undefined }
    : result;

  const saved = await prisma.analysis.create({
    data: {
      userId: input.userId,
      businessUnitCep: input.unidade.cep,
      businessUnitCnpj: input.unidade.cnpj,
      domain,
      reportJson: finalResult as any,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  await prisma.analysisHistory.create({
    data: {
      userId: input.userId,
      businessUnitCnpj: input.unidade.cnpj,
      businessUnitCep: input.unidade.cep,
      businessUnitName: input.unidade.nomeFantasia || input.unidade.razaoSocial,
      businessUnitCnae: input.unidade.cnaePrincipalCodigo,
      domain,
      cepCount: points.length,
      opportunityIndex: result.estatisticas.indiceOportunidadeMercado,
      fullReportJson: finalResult as any
    }
  });

  return { ...finalResult, id: saved.id };
}
