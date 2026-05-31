// Este arquivo faz o complemento opcional com OpenAI.
// Se nao houver OPENAI_API_KEY, a aplicacao continua funcionando com as regras locais.
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { assertMonthlyBudget } from '@/services/usage-budget';
import type { AnalysisResult } from '@/lib/types';

function extractJson(text: string) {
  // Modelos de IA as vezes devolvem JSON dentro de blocos de texto.
  // Esta funcao tenta recortar apenas o objeto JSON para a aplicacao conseguir ler.
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function enhanceWithOpenAI(base: AnalysisResult): Promise<Partial<AnalysisResult> | null> {
  // Esta funcao pede para a IA melhorar o plano de acao e o posicionamento.
  // Se a chamada falhar, retornamos null para usar o relatorio local sem quebrar a analise.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    empresa: {
      nome: base.unidade.nomeFantasia || base.unidade.razaoSocial,
      cnaeCadastralPrincipal: `${base.unidade.cnaePrincipalCodigo} - ${base.unidade.cnaePrincipalDescricao}`,
      bairro: base.unidade.bairro,
      cidade: base.unidade.municipio
    },
    escopoInformadoPeloUsuario: {
      descricaoDoRamo: base.businessActivityDescription || null,
      cnaesSelecionados: base.selectedCnaes,
      tiposDeConcorrentesSelecionados: base.competitorTypes
    },
    estatisticas: base.estatisticas,
    analysisRadiusKm: base.analysisRadiusKm,
    faseMercadoLocal: base.faseMercadoLocal,
    planoLocalInicial: base.planoDeAcao,
    canvasLocalInicial: base.businessModelCanvas,
    diagnosticoFontesPublicas: base.diagnosticoFontesPublicas,
    topBairros: base.afinidadePorBairro.slice(0, 10),
    obstaculos: base.obstaculosMatricula.slice(0, 10),
    locais: base.strategicPlaces.slice(0, 40).map((place) => ({
      nome: place.nome,
      categoria: place.categoriaEstrategica,
      subcategoria: place.subcategoria,
      distanciaKm: place.distanciaKm,
      rating: place.rating,
      avaliacoes: place.userRatingCount,
      observacao: place.observacaoEstrategica
    }))
  };

  const prompt = `
Você é especialista em inteligência de mercado para negócios B2B e B2C de diferentes setores.

Gere uma complementação em PT-BR, sem substituir a operação atual da empresa analisada. Trabalhe com evolução incremental: manter, melhorar, adicionar, testar antes de alterar e fazer sem prejudicar a operação.

Para o campo "planoDeAcao", aja como consultor executivo e entregue recomendações realmente acionáveis:
- Crie de 6 a 8 ações priorizadas.
- Use os bairros, concorrentes, avaliações, CNAEs, obstáculos e fase de mercado disponíveis.
- Respeite o escopo informado pelo usuário: descricaoDoRamo, cnaesSelecionados e tiposDeConcorrentesSelecionados. O CNAE cadastral principal serve apenas como contexto da empresa, não como permissão para mudar o segmento da análise.
- Cada ação deve começar com verbo de comando e dizer o que fazer, onde fazer e por que fazer.
- Evite conselhos genéricos como "melhorar marketing" sem canal, público, teste ou métrica.
- Inclua pelo menos uma ação de curto prazo, uma de prova social/reputação, uma de campanha local, uma de abordagem comercial e uma de mensuração.
- Se houver poucos dados do Google Places, deixe isso claro e proponha uma ação de validação manual.
- Não invente nomes, números, avaliações ou bairros que não estejam nos dados.

Para o campo "recomendacoesInteligentes", seja ainda mais sintético:
- Escreva como se fosse uma orientação executiva para quem tem pouco tempo.
- Não crie novas tarefas; transforme a análise em decisão, brecha e mensagem pronta.
- A mensagem pronta deve poder ser usada em WhatsApp, anúncio local ou abordagem comercial sem edição pesada.
- A objeção e a resposta devem ajudar atendimento/vendas a decidir o que falar primeiro.

Para o campo "businessModelCanvas", gere um Canvas do Modelo de Negócio aplicado:
- Use os mesmos dados, escopo informado pelo usuário, concorrentes, bairros e limitações.
- Não transforme o Canvas em tarefa para o usuário preencher; entregue a síntese já pronta.
- Cada bloco deve ter de 2 a 4 frases curtas e acionáveis.
- Não invente parceiros, canais, bairros, números, avaliações ou fontes de receita que não façam sentido para o segmento informado.

Responda APENAS JSON válido com os campos camelCase abaixo. Não invente dados estatísticos. Quando houver limitação, declare a limitação.

{
  "posicionamentoUnidade": {
    "forcasAtuais": [],
    "diferenciaisFrenteConcorrentes": [],
    "riscosDePosicionamento": [],
    "mensagensRecomendadas": [],
    "ajustesIncrementaisSugeridos": [],
    "hipotesesParaTestar": []
  },
  "evolucaoIncremental": {
    "manter": [],
    "melhorar": [],
    "adicionar": [],
    "testarAntesDeAlterar": [],
    "fazerSemPrejudicarOperacao": []
  },
  "recomendacoesInteligentes": {
    "prioridadePrincipal": "",
    "brechaCompetitiva": "",
    "personaFoco": "",
    "objecaoProvavel": "",
    "respostaRecomendada": "",
    "mensagemPronta": ""
  },
  "businessModelCanvas": {
    "propostaDeValor": [],
    "segmentosDeClientes": [],
    "canais": [],
    "relacionamentoComClientes": [],
    "fontesDeReceita": [],
    "recursosChave": [],
    "atividadesChave": [],
    "parceriasChave": [],
    "estruturaDeCustos": []
  },
  "planoDeAcao": [
    {
      "prioridade": 1,
      "acao": "",
      "tipo": "Manter | Melhorar | Adicionar | Testar",
      "impactoEsperado": "Alto | Médio | Baixo",
      "facilidadeExecucao": "Alta | Média | Baixa",
      "prazoSugerido": "",
      "custoEstimado": "Gratuito | Baixo | Médio | Alto",
      "recursoGratuitoConfirmado": true,
      "responsavelSugerido": "",
      "kpiParaMedirSucesso": ""
    }
  ]
}

Dados disponíveis:
${JSON.stringify(payload, null, 2)}
`;

  try {
    await assertMonthlyBudget('OPENAI');
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Responda apenas em JSON válido e em português brasileiro.' },
          { role: 'user', content: prompt }
        ]
      })
    }, 30000);

    if (!response.ok) return null;
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return extractJson(content) as Partial<AnalysisResult>;
  } catch {
    return null;
  }
}
