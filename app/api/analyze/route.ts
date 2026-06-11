// Esta API e chamada quando o visitante clica para iniciar a analise.
// Ela valida os dados recebidos, aplica limite por visitante e chama o motor principal de inteligencia de mercado.
// O servidor faz isso para proteger chaves secretas e para poder salvar historico no banco.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertUserRateLimit } from '@/services/rate-limit';
import { runMarketAnalysis } from '@/services/analysis';
import { DEFAULT_COMPETITOR_TYPES, isCompetitorType, type CompetitorType } from '@/lib/competitor-types';
import { anonymousUserId } from '@/lib/visitor';
import { DEFAULT_LANGUAGE, isAppLanguage } from '@/lib/i18n';

function apiText(language: 'pt-BR' | 'en-US', ptText: string, enText: string) {
  return language === 'en-US' ? enText : ptText;
}

const schema = z.object({
  unidade: z.any(),
  ceps: z.array(z.string()).optional().default([]),
  selectedCnaes: z.array(z.any()).optional().default([]),
  businessActivityDescription: z.string().trim().min(3).max(300),
  competitorTypes: z.array(z.string()).optional().default(DEFAULT_COMPETITOR_TYPES).transform((items) => items.filter(isCompetitorType) as CompetitorType[]),
  analysisRadiusKm: z.coerce.number().min(1).max(20).optional().default(4),
  language: z.string().optional().default(DEFAULT_LANGUAGE).transform((value) => (isAppLanguage(value) ? value : DEFAULT_LANGUAGE)),
  // Campos legados aceitos para não quebrar relatórios/cliente antigo.
  competitorType: z.string().optional(),
  domain: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const userId = anonymousUserId(request);
    await assertUserRateLimit(userId);
    const rawBody = await request.json();
    const requestLanguage = isAppLanguage(rawBody?.language) ? rawBody.language : DEFAULT_LANGUAGE;
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      const radiusIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'analysisRadiusKm');
      if (radiusIssue) {
        return NextResponse.json({ error: apiText(requestLanguage, 'O raio de análise deve ficar entre 1 e 20 km. Ajuste o campo e tente novamente.', 'The analysis radius must be between 1 and 20 km. Adjust the field and try again.') }, { status: 400 });
      }
      const activityIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'businessActivityDescription');
      if (activityIssue) {
        return NextResponse.json({ error: apiText(requestLanguage, 'Descreva o ramo de atividade antes de iniciar a análise.', 'Describe the business activity before starting the analysis.') }, { status: 400 });
      }
      return NextResponse.json({ error: apiText(requestLanguage, 'Alguns dados enviados estão em formato inválido. Revise o formulário e tente novamente.', 'Some submitted data is invalid. Review the form and try again.') }, { status: 400 });
    }
    const body = parsed.data;
    const competitorTypes = body.competitorTypes.length
      ? body.competitorTypes
      : body.competitorType && isCompetitorType(body.competitorType)
        ? [body.competitorType]
        : DEFAULT_COMPETITOR_TYPES;

    const result = await runMarketAnalysis({
      userId,
      unidade: body.unidade,
      ceps: body.ceps,
      businessActivityDescription: body.businessActivityDescription,
      competitorTypes,
      analysisRadiusKm: body.analysisRadiusKm,
      language: body.language
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao processar análise.' }, { status: 400 });
  }
}
