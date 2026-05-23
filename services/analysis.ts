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
    const direct = group.places.filter((place) => place.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
    const indirect = group.places.filter((place) => place.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
    const barriers = group.places.filter((place) => place.categoriaEstrategica === 'Barreira potencial de agenda').length;
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
      : `Análise baseada no raio de ${params.radiusKm} km em torno da unidade, sem planilha de CEPs.`;

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
        `${barriers} possível(is) barreira(s) de agenda escolar ou contraturno.`
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
  return scores.slice(0, 8).flatMap((score) => {
    const relatedPlaces = places.filter((place) => (place.bairro || score.bairro) === score.bairro || !place.bairro);
    const direct = score.concorrentesDiretos;
    const indirect = score.concorrentesIndiretos;
    const barriers = relatedPlaces.filter((place) => place.categoriaEstrategica === 'Barreira potencial de agenda');
    const items: AnalysisResult['obstaculosMatricula'] = [];
    if (direct > 0) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Concorrência direta de tecnologia',
        descricao: 'Há concorrentes com proposta próxima no raio analisado, incluindo tecnologia, programação, robótica, games ou maker.',
        evidencias: relatedPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente direto de tecnologia').slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: direct >= 4 ? 'Alto' : 'Médio',
        acaoRecomendada: `Comparar a proposta da unidade com os concorrentes locais e destacar diferenciais por idade, projeto prático, metodologia e aula experimental.`,
        deveSerTestadoAntes: true
      });
    }
    if (indirect >= 3) {
      items.push({
        bairro: score.bairro,
        tipoObstaculo: 'Disputa por agenda extracurricular',
        descricao: 'Atividades como idiomas, esportes, artes, música, reforço e entretenimento disputam tempo e orçamento familiar.',
        evidencias: relatedPlaces.filter((place) => place.categoriaEstrategica === 'Concorrente indireto extracurricular').slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: 'Médio',
        acaoRecomendada: 'Tratar tecnologia como complemento estratégico e desenvolvimento de futuro, não como substituto genérico de outras atividades.',
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
        tipoObstaculo: 'Possível barreira de agenda escolar',
        descricao: 'Foram identificadas escolas, colégios ou programas de contraturno que podem disputar a disponibilidade das crianças e adolescentes.',
        evidencias: barriers.slice(0, 5).map((place) => `${place.nome}${place.rating ? ` — ${place.rating.toFixed(1)}★` : ''}`),
        impactoEstimado: barriers.length >= 4 ? 'Médio' : 'Baixo',
        acaoRecomendada: 'Perguntar no atendimento se a criança estuda em horário integral ou contraturno e ajustar a oferta somente após validação.',
        deveSerTestadoAntes: true
      });
    }
    return items;
  });
}

function buildPersonas(unidade: UnidadeNegocio, topBairro: string): Persona[] {
  return [
    {
      nomeFicticio: 'Mariana e Lucas, 8 anos', idade: 'Mãe de 38–45 anos', filhoIdade: '8 anos', filhoPerfil: 'Criança curiosa, gosta de montar coisas, robôs, peças e desafios concretos.', papelDoFilhoNaDecisao: 'Alto: se ele se encanta na aula experimental, a chance de matrícula sobe muito.', perfilFamiliar: `Família próxima de ${topBairro}, busca atividade com propósito e menos tela passiva.`, classeAbepEstimativa: 'A/B ou C alta, conforme recorrência de leads e ticket do curso.', motivacoes: ['Desenvolver raciocínio lógico', 'Reduzir consumo passivo de telas', 'Encontrar uma atividade que gere orgulho e evolução visível'], doresEObjecoes: ['Medo de compromisso longo', 'Dúvida se a criança vai manter interesse', 'Agenda semanal cheia'], canaisPreferidos: ['WhatsApp', 'Instagram', 'Indicação de outros pais'], disponibilidadeDeCompra: 'Alta quando a aula experimental demonstra segurança, acolhimento e evolução prática.', gatilhosDeDecisao: ['Aula experimental', 'Foto/vídeo do projeto montado', 'Explicação da trilha por idade'], mensagemRecomendada: 'Transforme curiosidade em criação: uma aula prática para seu filho montar, testar e se orgulhar do que fez.'
    },
    {
      nomeFicticio: 'Ricardo e Pedro, 13 anos', idade: 'Pai de 42–52 anos', filhoIdade: '13 anos', filhoPerfil: 'Adolescente interessado em games, YouTube, IA e aplicativos.', papelDoFilhoNaDecisao: 'Muito alto: o adolescente precisa perceber relevância e desafio, não apenas “curso que os pais escolheram”.', perfilFamiliar: 'Família compara opções presenciais com cursos online e quer evidências de resultado.', classeAbepEstimativa: 'A/B/C alta', motivacoes: ['Transformar interesse por tecnologia em habilidade real', 'Preparação para futuro profissional', 'Projetos para portfólio'], doresEObjecoes: ['Compara preço com curso online', 'Quer ver conteúdo avançado', 'Deslocamento'], canaisPreferidos: ['Google', 'WhatsApp', 'YouTube/Instagram'], disponibilidadeDeCompra: 'Média a alta quando entende a diferença entre acompanhamento presencial e conteúdo solto online.', gatilhosDeDecisao: ['Projetos reais', 'IA, games e programação', 'Professor que conversa bem com adolescente'], mensagemRecomendada: 'Do interesse por games e IA para projetos reais em tecnologia, com orientação presencial e trilha clara.'
    },
    {
      nomeFicticio: 'Fernanda e Sofia, 6 anos', idade: 'Mãe de 34–42 anos', filhoIdade: '6 anos', filhoPerfil: 'Criança em fase inicial, precisa de acolhimento, lúdico e atividades concretas.', papelDoFilhoNaDecisao: 'Alto: a criança decide pela experiência emocional, acolhimento e diversão.', perfilFamiliar: 'Busca primeira atividade tecnológica sem excesso de tela.', classeAbepEstimativa: 'A/B/C alta', motivacoes: ['Coordenação motora', 'Organização mental', 'Criatividade', 'Primeiro contato positivo com tecnologia'], doresEObjecoes: ['Acha que pode ser cedo demais', 'Preocupação com frustração', 'Medo de parecer aula escolar'], canaisPreferidos: ['Instagram', 'WhatsApp', 'Indicação escolar'], disponibilidadeDeCompra: 'Alta com abordagem lúdica e explicação de desenvolvimento por idade.', gatilhosDeDecisao: ['Ambiente acolhedor', 'Atividade mão na massa', 'Comunicação de “sem tela passiva”'], mensagemRecomendada: 'Tecnologia para pequenos criadores: montar, imaginar e aprender brincando.'
    },
    {
      nomeFicticio: 'Carlos e João, 10 anos', idade: 'Pai/mãe de 40–50 anos', filhoIdade: '10 anos', filhoPerfil: 'Criança competitiva, gosta de desafios, robôs, campeonatos e reconhecimento.', papelDoFilhoNaDecisao: 'Muito alto: ele quer desafio, ranking, conquista e algo para mostrar.', perfilFamiliar: 'Valoriza atividade que desenvolva foco, persistência e solução de problemas.', classeAbepEstimativa: 'A/B/C alta', motivacoes: ['Autonomia', 'Raciocínio lógico', 'Confiança', 'Participação em desafios'], doresEObjecoes: ['Concorrência com esporte', 'Horários', 'Preço versus outras atividades'], canaisPreferidos: ['WhatsApp', 'Eventos', 'Instagram'], disponibilidadeDeCompra: 'Alta quando percebe desafio prático e evolução mensurável.', gatilhosDeDecisao: ['Robocopa/desafios', 'Demonstração de robôs', 'Certificado ou projeto concluído'], mensagemRecomendada: 'Para crianças que gostam de desafio: robótica e programação com projetos que saem do papel.'
    },
    {
      nomeFicticio: 'Ana e Bia, 15 anos', idade: 'Responsável de 39–50 anos', filhoIdade: '15 anos', filhoPerfil: 'Adolescente criativa, interessada em design, conteúdo, apps, IA e possibilidades de carreira.', papelDoFilhoNaDecisao: 'Decisivo: precisa ver utilidade real, autonomia e conexão com seus interesses.', perfilFamiliar: 'Busca algo que una criatividade, tecnologia e futuro profissional.', classeAbepEstimativa: 'A/B/C alta', motivacoes: ['Portfólio', 'Criatividade', 'IA aplicada', 'Primeiras habilidades profissionais'], doresEObjecoes: ['Medo de curso infantilizado', 'Preferência por online', 'Agenda com escola/vestibular'], canaisPreferidos: ['Instagram', 'Google', 'WhatsApp'], disponibilidadeDeCompra: 'Média a alta se a comunicação mostrar projetos maduros e aplicáveis.', gatilhosDeDecisao: ['Exemplos de apps', 'IA na prática', 'Projetos visuais e autorais'], mensagemRecomendada: 'Tecnologia para criar: apps, IA e projetos digitais com aplicação real.'
    },
    {
      nomeFicticio: 'Patrícia e Gabriel, 11 anos', idade: 'Mãe de 36–48 anos', filhoIdade: '11 anos', filhoPerfil: 'Criança tímida ou neurodivergente, com forte interesse específico em tecnologia ou construção.', papelDoFilhoNaDecisao: 'Alto, mas depende de segurança emocional e acolhimento no ambiente.', perfilFamiliar: 'Procura uma atividade estruturada, acolhedora e respeitosa ao ritmo da criança.', classeAbepEstimativa: 'A/B/C alta', motivacoes: ['Autoconfiança', 'Socialização gradual', 'Interesse por tecnologia', 'Ambiente seguro'], doresEObjecoes: ['Medo de não adaptação', 'Experiências anteriores ruins', 'Preocupação com turma e professor'], canaisPreferidos: ['WhatsApp', 'Indicação', 'Instagram'], disponibilidadeDeCompra: 'Alta quando o atendimento demonstra escuta, respeito ao ritmo e clareza de acompanhamento.', gatilhosDeDecisao: ['Aula experimental cuidadosa', 'Turma adequada', 'Comunicação empática'], mensagemRecomendada: 'Um espaço para aprender tecnologia com acolhimento, ritmo e projetos que valorizam o jeito de cada criança.'
    }
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
  const rawCeps = Array.isArray(input.ceps) ? input.ceps : [];
  const validCeps = [...new Set(rawCeps.map(normalizeCep).filter(isValidCep))];
  const invalidCeps = rawCeps.map(String).filter((cep) => cep.trim() && !isValidCep(cep));
  const analysisRadiusKm = Math.max(1, Math.min(50, Number(input.analysisRadiusKm || 8)));
  const selectedCnaes = input.selectedCnaes?.length ? input.selectedCnaes : input.unidade.cnaes.slice(0, 3);
  const competitorTypes = input.competitorTypes?.length ? input.competitorTypes : DEFAULT_COMPETITOR_TYPES;
  const domain = selectedCnaes.map((cnae) => `${cnae.codigo ? `${cnae.codigo} — ` : ''}${cnae.descricao}`).join(' | ') || input.unidade.cnaePrincipalDescricao;

  const unitGeo = await geocodeCep(input.unidade.cep);
  if (!unitGeo) throw new Error('Não foi possível geocodificar o CEP da unidade obtido pelo CNPJ.');

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
  const directCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente direto de tecnologia').length;
  const indirectCount = strategicPlaces.filter((p) => p.categoriaEstrategica === 'Concorrente indireto extracurricular').length;
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
      justificativa: `Classificação baseada na região de atuação de ${analysisRadiusKm} km ao redor da unidade, ${points.length} CEP(s) de clientes enviados, ${directCount} concorrente(s) direto(s) e ${indirectCount} concorrente(s) indireto(s) mapeados via Google Places.`,
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
        'A análise considera a região real da unidade detectada pelo CNPJ, e não um território genérico.',
        'Aula experimental, atendimento consultivo e demonstração prática continuam sendo ativos importantes para conversão.'
      ],
      diferenciaisFrenteConcorrentes: [
        `Frente aos concorrentes mapeados em até ${analysisRadiusKm} km, a unidade deve destacar projetos práticos, tecnologia aplicada e trilha por idade.`,
        'Quando competir com esportes, idiomas e artes, posicionar tecnologia como complemento de futuro e não apenas mais uma atividade.',
        'Quando competir com escolas de tecnologia, reforçar acompanhamento presencial, projeto concluído e clareza da evolução do aluno.'
      ],
      riscosDePosicionamento: [
        'Concorrentes com muitas avaliações no Google podem transmitir confiança inicial maior; usar prova social local e aula experimental para reduzir esse risco.',
        'Se houver muita oferta extracurricular na região, a objeção principal pode ser agenda, não interesse.',
        'Famílias podem comparar preço se o atendimento não mostrar valor antes da proposta comercial.'
      ],
      mensagensRecomendadas: [
        `Para famílias de ${topBairro}: tecnologia como criação, raciocínio lógico e preparo para o futuro.`,
        'Aula experimental para identificar a trilha ideal por idade, maturidade e interesse da criança ou adolescente.',
        'Menos tela passiva, mais construção, projeto e autonomia.'
      ],
      ajustesIncrementaisSugeridos: [
        `Testar campanha local em ${topBairro} e bairros próximos antes de ampliar verba.`,
        'Registrar objeções por bairro: distância, agenda, preço e comparação com concorrentes.',
        'Criar respostas comerciais citando diferenciais frente aos tipos de concorrentes selecionados.'
      ],
      hipotesesParaTestar: [
        `Bairros com maior score no raio de ${analysisRadiusKm} km tendem a gerar mais agendamentos de aula experimental.`,
        'Mensagens com projetos práticos convertem melhor que mensagens genéricas sobre futuro.',
        'Pais decidem melhor quando o filho participa da experiência e aprova a atividade.'
      ]
    },
    personas: buildPersonas(input.unidade, topBairro),
    evolucaoIncremental: {
      manter: ['WhatsApp como principal canal de conversão.', 'Aula experimental como porta de entrada consultiva.', 'Comunicação centrada em tecnologia como desenvolvimento de futuro.'],
      melhorar: [`Segmentação por bairros dentro do raio de ${analysisRadiusKm} km.`, 'Scripts de objeção por idade, bairro e tipo de concorrente.', 'Mensuração de leads por origem geográfica e por concorrente citado.'],
      adicionar: ['Ranking de bairros prioritários para campanhas locais.', 'Lista de concorrentes com avaliação Google para comparação comercial.', 'Campo de objeções no follow-up para validar barreiras regionais.'],
      testarAntesDeAlterar: ['Campanhas por raio nos bairros com maior afinidade.', 'Mensagens específicas para pais de crianças versus adolescentes.', 'Ofertas pontuais para bairros com maior distância da unidade.'],
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
      { prioridade: 1, acao: `Priorizar os bairros com maior afinidade dentro de ${analysisRadiusKm} km para campanhas e follow-up ativo.`, tipo: 'Testar', impactoEsperado: 'Alto', facilidadeExecucao: 'Alta', prazoSugerido: '7 a 14 dias', custoEstimado: 'Baixo', recursoGratuitoConfirmado: false, responsavelSugerido: 'Comercial/Marketing', kpiParaMedirSucesso: 'Agendamentos de aula experimental por bairro' },
      { prioridade: 2, acao: 'Criar argumento comercial comparando a unidade com os concorrentes diretos mais bem avaliados no Google.', tipo: 'Melhorar', impactoEsperado: 'Alto', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing/Atendimento', kpiParaMedirSucesso: 'Taxa de avanço do WhatsApp para visita/aula experimental' },
      { prioridade: 3, acao: 'Perguntar no atendimento se a criança ou adolescente já faz idioma, esporte, reforço ou escola integral.', tipo: 'Adicionar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '1 semana', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Atendimento', kpiParaMedirSucesso: 'Objeções registradas por lead e bairro' },
      { prioridade: 4, acao: 'Criar mensagens diferentes para crianças 5–10, pré-adolescentes 11–14 e adolescentes 15–17.', tipo: 'Melhorar', impactoEsperado: 'Médio', facilidadeExecucao: 'Alta', prazoSugerido: '2 semanas', custoEstimado: 'Gratuito', recursoGratuitoConfirmado: true, responsavelSugerido: 'Marketing', kpiParaMedirSucesso: 'CTR e taxa de resposta por faixa etária' }
    ],
    proximaRevisaoRecomendada: new Date(today.getTime() + reviewDays * 24 * 60 * 60 * 1000).toISOString(),
    iaAviso: process.env.OPENAI_API_KEY ? undefined : 'A análise com IA avançada não foi executada porque a chave OpenAI não está configurada. O relatório usa regras locais, Google Places e dados públicos disponíveis.'
  };
  result.posicionamentoMyRobot = result.posicionamentoUnidade;

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
