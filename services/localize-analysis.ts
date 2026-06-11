// Converte os blocos narrativos do resultado para o idioma escolhido.
// As categorias internas continuam em PT-BR para preservar filtros, pesos e compatibilidade.
import { competitorLabel, type AppLanguage } from '@/lib/i18n';
import type { AnalysisResult, BusinessModelCanvas, Persona, StrategicPlace } from '@/lib/types';

function englishPlaceObservation(place: StrategicPlace) {
  const rating = place.rating ? ` Google rating: ${place.rating.toFixed(1)} (${place.userRatingCount || 0} reviews).` : ' Google rating is not available.';
  if (place.categoriaEstrategica.includes('Concorrente direto')) {
    return `Mapped as a likely direct competitor or a very close offer for the analyzed business activity.${rating}`;
  }
  if (place.categoriaEstrategica.includes('Concorrente indireto')) {
    return `May compete indirectly for attention, budget, convenience, or the same buying occasion.${rating}`;
  }
  if (place.categoriaEstrategica.includes('Polo gerador')) {
    return `May concentrate local traffic and support local outreach, partnerships, or prospecting.${rating}`;
  }
  if (place.categoriaEstrategica.includes('Barreira')) {
    return `May affect access, convenience, traffic, or buying decisions. Validate its real impact with leads and customers.${rating}`;
  }
  if (place.categoriaEstrategica.includes('Oportunidade')) {
    return `May complement the offer and create partnership, referral, or joint local action opportunities.${rating}`;
  }
  return `Relevant place mapped around the analyzed region. Validate its relationship to the business before using it in decisions.${rating}`;
}

function englishDiagnostics(result: AnalysisResult) {
  const hasGoogleKeyConfigured = result.diagnosticoFontesPublicas.some((item) => item.includes('Google Places está configurado'));
  return [
    ...result.diagnosticoFontesPublicas
      .filter((item) => !item.includes('ViaCEP resolve') && !item.includes('IBGE Localidades') && !item.includes('SIDRA exige') && !item.includes('PNAD Contínua') && !item.includes('Censo 2022') && !item.includes('Google Places está configurado') && !item.includes('Google Places não foi executado porque'))
      .map((item) => item
        .replace('Google Places executou, mas não retornou locais aproveitáveis para os termos, raio e coordenadas desta análise. Nenhum resultado vazio foi gravado no cache.', 'Google Places ran, but returned no usable places for the terms, radius, and coordinates in this analysis. Empty results were not cached.')
        .replace('Google Places retornou', 'Google Places returned')
        .replace('local(is) relevante(s) depois de filtros de raio, duplicidade e identificação da própria empresa.', 'relevant place(s) after radius, duplicate, and own-company filters.')
      ),
    hasGoogleKeyConfigured
      ? 'Google Places is configured to map competitors, ratings, review counts, and public place data inside the selected radius.'
      : 'Google Places did not run because GOOGLE_MAPS_SERVER_API_KEY or GOOGLE_PLACES_API_KEY is not configured.',
    'ViaCEP resolves ZIP/postal codes to address, neighborhood, city, and state, but does not provide income data.',
    'IBGE Localidades identifies city/state, but does not provide income by neighborhood.',
    'SIDRA requires table, variable, period, classification, and territorial level; it is not a generic ZIP/postal-code lookup.',
    'PNAD Contínua is sample-based and normally does not provide neighborhood/ZIP-level granularity.',
    'Census 2022 can enrich the analysis, but requires ETL with census tracts, territorial geometry, and geographic matching.'
  ];
}

function englishCanvas(input: {
  result: AnalysisResult;
  unitName: string;
  segment: string;
  topBairro: string;
  directCount: number;
  hasCustomerCepData: boolean;
}): BusinessModelCanvas {
  const competitorReference = input.directCount > 0 ? 'nearby competitors with public Google signals' : 'local alternatives that still need manual validation';
  const selectedTypes = input.result.competitorTypes.map((type) => competitorLabel('en-US', type)).join(', ');
  return {
    propostaDeValor: [
      `${input.unitName} should communicate a clear local solution for ${input.segment}, with fast response and practical next steps.`,
      `Differentiate with proof, perceived quality, convenience, and a simple comparison against ${competitorReference}.`,
      `Keep the offer easy to understand so prospects do not compare only on price.`
    ],
    segmentosDeClientes: [
      input.hasCustomerCepData ? `Current customers and decision makers near ${input.topBairro}.` : `Potential customers inside a ${input.result.analysisRadiusKm} km radius around the reference location.`,
      'People who search on Google before contacting a provider.',
      'Prospects who value speed, trust, and low friction before making a decision.'
    ],
    canais: [
      'Google Maps and local organic search.',
      'WhatsApp or another direct response channel.',
      input.hasCustomerCepData ? 'Radius campaigns around neighborhoods with actual customer ZIP/postal codes.' : `Small radius campaigns inside ${input.result.analysisRadiusKm} km to build a real lead base.`,
      'Local referrals, proof, and complementary partnerships.'
    ],
    relacionamentoComClientes: [
      'Consultative service with one clear next step.',
      'Fast answers about price, timing, availability, and differentiators.',
      'Follow-up organized by lead source, objection, and neighborhood when available.'
    ],
    fontesDeReceita: [
      `Direct sales of ${input.segment}.`,
      'Packages, plans, recurring offers, or contracts when they fit the business.',
      'Upsell or complementary services after the first conversion.'
    ],
    recursosChave: [
      'A person or team responsible for fast response and objection tracking.',
      'An updated Google Business Profile with photos, description, reviews, and correct data.',
      'Commercial arguments that compare real differentiators against selected competitor types.'
    ],
    atividadesChave: [
      'Monitor competitors and reviews inside the selected radius.',
      selectedTypes ? `Review results linked to ${selectedTypes} to keep the analysis aligned with the selected scope.` : 'Review the competitive scope periodically.',
      'Measure leads, replies, quotes, and conversions by source.'
    ],
    parceriasChave: [
      'Complementary local businesses for mutual referrals.',
      'Suppliers, local influencers, or community channels with access to the target audience.',
      'Low-risk pilot partnerships before larger investments.'
    ],
    estruturaDeCustos: [
      'Small local media budget for tests before scaling.',
      'Time for service, follow-up, lead organization, and review monitoring.',
      'Commercial proof production: photos, testimonials, landing pages, messages, and materials.'
    ]
  };
}

function englishPersonas(segment: string, topBairro: string): Persona[] {
  return [
    {
      nomeFicticio: 'Nearby customer',
      idade: 'Resident or frequent buyer in the region',
      decisorPrincipal: 'Resident or frequent buyer in the region',
      perfilComprador: `Looks for a reliable ${segment} option near ${topBairro}, with fast service and local trust signals.`,
      papelNaDecisao: 'Decision maker or relevant purchase influencer.',
      filhoIdade: 'Not applicable',
      filhoPerfil: `Looks for a reliable ${segment} option near ${topBairro}, with fast service and local trust signals.`,
      papelDoFilhoNaDecisao: 'Not applicable to a generic business model.',
      perfilFamiliar: `Looks for a reliable ${segment} option near ${topBairro}, with fast service and local trust signals.`,
      classeAbepEstimativa: 'To be defined with real ticket, recurrence, and customer-source data.',
      motivacoes: ['Convenience', 'Trust in the service', 'Good value for money'],
      doresEObjecoes: ['Little time to compare options', 'Fear of poor service', 'Price and timing sensitivity'],
      canaisPreferidos: ['Google', 'WhatsApp', 'Local referral'],
      disponibilidadeDeCompra: 'Depends on urgency, trust, convenience, perceived price, and local proof.',
      gatilhosDeDecisao: ['Positive reviews', 'Fast response', 'Convenient location'],
      mensagemRecomendada: `A reliable ${segment} option near you, with clear service and a simple next step.`
    },
    {
      nomeFicticio: 'Comparison buyer',
      idade: 'Person who researches before buying',
      decisorPrincipal: 'Person who researches before buying',
      perfilComprador: `Compares ${segment} providers, reviews, perceived quality, and proof before deciding.`,
      papelNaDecisao: 'Decision maker or relevant purchase influencer.',
      filhoIdade: 'Not applicable',
      filhoPerfil: `Compares ${segment} providers, reviews, perceived quality, and proof before deciding.`,
      papelDoFilhoNaDecisao: 'Not applicable to a generic business model.',
      perfilFamiliar: `Compares ${segment} providers, reviews, perceived quality, and proof before deciding.`,
      classeAbepEstimativa: 'To be defined with real ticket, recurrence, and customer-source data.',
      motivacoes: ['Reduce choice risk', 'Find better perceived value', 'See evidence before contact'],
      doresEObjecoes: ['Incomplete information', 'Generic promises', 'Doubt between similar options'],
      canaisPreferidos: ['Google', 'Instagram', 'Review sites'],
      disponibilidadeDeCompra: 'Depends on urgency, trust, convenience, perceived price, and local proof.',
      gatilhosDeDecisao: ['Social proof', 'Portfolio or real cases', 'Well-explained offer'],
      mensagemRecomendada: 'Compare safely: see differentiators, reviews, and why this offer fits your need.'
    }
  ];
}

export function localizeAnalysisResult(result: AnalysisResult, language: AppLanguage): AnalysisResult {
  if (language === 'pt-BR') return { ...result, language };

  const unitName = result.unidade.nomeFantasia || result.unidade.razaoSocial;
  const segment = result.businessActivityDescription || result.unidade.cnaePrincipalDescricao || 'the stated business activity';
  const topBairro = result.afinidadePorBairro[0]?.bairro || result.unidade.bairro || 'the selected area';
  const hasCustomerCepData = result.points.length > 0;
  const directCount = result.strategicPlaces.filter((place) => place.categoriaEstrategica.includes('Concorrente direto')).length;
  const indirectCount = result.strategicPlaces.filter((place) => place.categoriaEstrategica.includes('Concorrente indireto')).length;

  const strategicPlaces = result.strategicPlaces.map((place) => ({
    ...place,
    observacaoEstrategica: englishPlaceObservation(place)
  }));

  const neighborhoodScores = result.afinidadePorBairro.map((item) => ({
    ...item,
    evidencias: [
      `${item.cepCount} current customer ZIP/postal code(s) were uploaded for this neighborhood.`,
      `${item.concorrentesDiretos} direct competitor(s) were mapped in the same neighborhood by Google Places.`,
      `${item.concorrentesIndiretos} indirect competitor(s) were mapped in the same neighborhood.`,
      `${item.polosFamiliares} traffic generator(s) may affect local demand.`
    ],
    limitacoes: [
      'This ranking exists only because customer ZIP/postal codes were uploaded.',
      'Ratings and places come from Google Places and depend on public data availability in the region.'
    ],
    acaoRecomendada: item.score >= 75
      ? `Prioritize campaigns and follow-up for ${item.bairro}, using clear differentiators against local competitors.`
      : item.score >= 55
        ? `Run a low-cost campaign for ${item.bairro} before scaling investment.`
        : `Monitor ${item.bairro} and validate demand manually before prioritizing media.`
  }));

  const recommendations = {
    prioridadePrincipal: hasCustomerCepData
      ? `Focus the first commercial round on ${topBairro}, using a clear offer that is easy to compare.`
      : `Focus the first commercial round inside the ${result.analysisRadiusKm} km radius around the reference location; do not assume customer neighborhoods until real ZIP/postal codes or leads exist.`,
    brechaCompetitiva: directCount > 0
      ? 'Use convenience, fast response, and local proof to compete against nearby alternatives.'
      : `The low number of direct competitors inside ${result.analysisRadiusKm} km suggests room to test local presence before increasing investment.`,
    personaFoco: 'Prioritize decision makers who value proximity, fast response, trust, and simple comparison.',
    objecaoProvavel: 'The most likely objection is comparison by price, reputation, or convenience.',
    respostaRecomendada: 'Answer with a concrete differentiator, timing, proof, and one simple next step.',
    mensagemPronta: `Hi! ${unitName} serves your area with practical guidance, clear communication, and fast response. Can I show you the best option for what you need today?`
  };

  return {
    ...result,
    language,
    domain: `Stated business activity: ${segment}`,
    strategicPlaces,
    perfilEconomico: neighborhoodScores,
    afinidadePorBairro: neighborhoodScores,
    faseMercadoLocal: {
      ...result.faseMercadoLocal,
      justificativa: hasCustomerCepData
        ? `Classification based on the stated business activity, a ${result.analysisRadiusKm} km radius around the company, ${result.points.length} uploaded customer ZIP/postal code(s), and ${directCount} direct competitor(s) plus ${indirectCount} indirect competitor(s) mapped through Google Places.`
        : `Classification based on the stated business activity, a ${result.analysisRadiusKm} km radius around the reference location, and ${directCount} direct competitor(s) plus ${indirectCount} indirect competitor(s) mapped through Google Places. Customer-affinity sections were not generated because no customer ZIP/postal codes were uploaded.`
    },
    estatisticas: {
      ...result.estatisticas,
      distribuicaoDistancias: result.estatisticas.distribuicaoDistancias.map((item) => ({
        ...item,
        faixa: item.faixa.replace('Até', 'Up to')
      }))
    },
    obstaculosMatricula: result.obstaculosMatricula.map((item) => ({
      ...item,
      bairro: item.bairro === 'Raio analisado' ? 'Analyzed radius' : item.bairro,
      tipoObstaculo: item.tipoObstaculo.includes('Concorrência') ? 'Competitive pressure' : item.tipoObstaculo.includes('Alternativas') ? 'Indirect alternatives' : item.tipoObstaculo.includes('Distância') ? 'Distance inside the radius' : 'Access or convenience barrier',
      descricao: 'This item points to a market signal that may affect conversion. Use it as a hypothesis, then validate it with real leads and customers.',
      acaoRecomendada: 'Compare offer, reputation, response speed, convenience, and proof before changing price or positioning. Test a small message or campaign first.'
    })),
    posicionamentoUnidade: {
      forcasAtuais: [
        `${unitName} operates around ${result.unidade.bairro}, ${result.unidade.municipio}/${result.unidade.uf}, with the scope defined by the stated activity: ${segment}.`,
        'The analysis uses the real reference location rather than a generic territory.',
        'Consultative service, social proof, clear offer, and local convenience are important conversion assets.'
      ],
      diferenciaisFrenteConcorrentes: [
        `Against competitors mapped within ${result.analysisRadiusKm} km, highlight quality, reputation, convenience, perceived price, and response speed.`,
        'When competing with indirect alternatives, position the offer by the problem it solves better, not only by category.',
        'When competing with chains or highly rated businesses, reinforce local differentiators, human service, and concrete proof.'
      ],
      riscosDePosicionamento: [
        'Competitors with many Google reviews may create stronger initial trust; use local proof to reduce that risk.',
        'If similar offers are common nearby, the main objection may be differentiation, convenience, or price.',
        'Prospects may compare only by price if the first response does not show value.'
      ],
      mensagensRecomendadas: [
        `For prospects near ${topBairro}: reliable local solution, clear service, and fast response.`,
        'Explain the offer in terms of problem solved, timing, quality, perceived price, and proof.',
        'Show concrete differentiators before asking for a purchase decision.'
      ],
      ajustesIncrementaisSugeridos: [
        hasCustomerCepData ? `Test a local campaign in ${topBairro} and nearby neighborhoods before scaling budget.` : `Test a campaign inside a ${result.analysisRadiusKm} km radius before choosing specific neighborhoods.`,
        hasCustomerCepData ? 'Track objections by neighborhood: distance, schedule, price, and competitor comparison.' : 'Track objections by lead source: distance, schedule, price, and competitor comparison.',
        'Create commercial replies that mention differentiators against the selected competitor types.'
      ],
      hipotesesParaTestar: [
        hasCustomerCepData ? `Neighborhoods with higher scores inside ${result.analysisRadiusKm} km may generate more qualified leads.` : `The ${result.analysisRadiusKm} km radius may generate qualified demand if the offer clearly explains why it is better than nearby options.`,
        'Messages with social proof and a concrete benefit should convert better than generic messages.',
        'Prospects move faster when they receive price, timing, and differentiators objectively.'
      ]
    },
    personas: englishPersonas(segment, topBairro),
    evolucaoIncremental: {
      manter: ['Keep WhatsApp or another direct channel as the main conversion point.', 'Keep consultative service as the entry point.', 'Keep communication centered on the problem the business solves.'],
      melhorar: [hasCustomerCepData ? `Improve segmentation around neighborhoods with customers inside ${result.analysisRadiusKm} km.` : `Improve initial segmentation by ${result.analysisRadiusKm} km radius without assuming customer neighborhoods.`, 'Improve objection scripts by customer profile, lead source, and cited competitor.', 'Measure leads by geographic source and cited competitor.'],
      adicionar: [hasCustomerCepData ? 'Add a priority-neighborhood ranking for local campaigns.' : 'Add ZIP/postal code or neighborhood capture for new leads to build a real future customer base.', 'Add a simple competitor comparison list using Google ratings.', 'Add an objection field in follow-up to validate regional barriers.'],
      testarAntesDeAlterar: [hasCustomerCepData ? 'Test radius campaigns in neighborhoods with higher affinity.' : 'Test broad radius campaigns before choosing priority neighborhoods.', 'Test messages by buying intent and urgency level.', 'Test small offers before changing price or operations.'],
      fazerSemPrejudicarOperacao: ['Use the data as a weekly decision layer without replacing current operations.', 'Run small tests before changing investment, prices, or offer format.']
    },
    diagnosticoFontesPublicas: englishDiagnostics(result),
    recomendacoesInteligentes: recommendations,
    businessModelCanvas: englishCanvas({ result, unitName, segment, topBairro, directCount, hasCustomerCepData }),
    planoDeAcao: [
      {
        prioridade: 1,
        acao: hasCustomerCepData
          ? `Prioritize ${topBairro} and other neighborhoods with real customer ZIP/postal codes: run a small radius campaign, track lead source, and compare response rate before scaling budget.`
          : `Validate demand inside the ${result.analysisRadiusKm} km radius without assuming customer neighborhoods: run a small radius campaign, collect ZIP/neighborhood from leads, and review in 7 days which areas responded better.`,
        tipo: 'Testar',
        impactoEsperado: 'Alto',
        facilidadeExecucao: 'Alta',
        prazoSugerido: '7 to 14 days',
        custoEstimado: 'Baixo',
        recursoGratuitoConfirmado: false,
        responsavelSugerido: 'Sales/Marketing',
        kpiParaMedirSucesso: hasCustomerCepData ? 'Qualified leads by neighborhood' : 'Qualified leads by radius, stated neighborhood, and cost per lead'
      },
      {
        prioridade: 2,
        acao: 'Create a simple comparison matrix with the 5 strongest direct competitors: Google rating, distance, main promise, public pricing when available, contact channel, and perceived differentiator. Use it to write better sales replies.',
        tipo: 'Melhorar',
        impactoEsperado: 'Alto',
        facilidadeExecucao: 'Alta',
        prazoSugerido: '1 week',
        custoEstimado: 'Gratuito',
        recursoGratuitoConfirmado: true,
        responsavelSugerido: 'Marketing/Service',
        kpiParaMedirSucesso: 'Rate from first contact to quote or visit'
      },
      {
        prioridade: 3,
        acao: 'Track which competitor or alternative the lead mentioned, which objection appeared first, and which answer helped the lead move forward. Review weekly and adjust the message.',
        tipo: 'Adicionar',
        impactoEsperado: 'Médio',
        facilidadeExecucao: 'Alta',
        prazoSugerido: '1 week',
        custoEstimado: 'Gratuito',
        recursoGratuitoConfirmado: true,
        responsavelSugerido: 'Service',
        kpiParaMedirSucesso: 'Objections recorded per lead and advancement rate by objection'
      }
    ],
    iaAviso: result.iaAviso ? 'Advanced AI enrichment did not run because the OpenAI key is not configured. The report uses local rules, Google Places, and available public data.' : undefined
  };
}
