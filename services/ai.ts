import type { AnalysisResult } from '@/lib/types';

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function enhanceWithOpenAI(base: AnalysisResult): Promise<Partial<AnalysisResult> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    unidade: {
      nome: base.unidade.nomeFantasia || base.unidade.razaoSocial,
      cnae: `${base.unidade.cnaePrincipalCodigo} - ${base.unidade.cnaePrincipalDescricao}`,
      bairro: base.unidade.bairro,
      cidade: base.unidade.municipio
    },
    estatisticas: base.estatisticas,
    competitorTypes: base.competitorTypes,
    selectedCnaes: base.selectedCnaes,
    analysisRadiusKm: base.analysisRadiusKm,
    topBairros: base.afinidadePorBairro.slice(0, 10),
    locais: base.strategicPlaces.slice(0, 40).map((place) => ({
      nome: place.nome,
      categoria: place.categoriaEstrategica,
      distanciaKm: place.distanciaKm,
      rating: place.rating,
      avaliacoes: place.userRatingCount,
      observacao: place.observacaoEstrategica
    }))
  };

  const prompt = `
Você é especialista em inteligência de mercado para negócios B2B e B2C de diferentes setores.

Gere uma complementação em PT-BR, sem substituir a operação atual da unidade analisada. Trabalhe com evolução incremental: manter, melhorar, adicionar, testar antes de alterar e fazer sem prejudicar a operação.

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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    });

    if (!response.ok) return null;
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return extractJson(content) as Partial<AnalysisResult>;
  } catch {
    return null;
  }
}
