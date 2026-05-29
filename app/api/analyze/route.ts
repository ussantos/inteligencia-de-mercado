// Esta API e chamada quando o usuario clica para iniciar a analise.
// Ela valida os dados recebidos, confere se o usuario esta logado e chama o motor principal de inteligencia de mercado.
// O servidor faz isso para proteger chaves secretas e para poder salvar historico no banco.
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { assertUserRateLimit } from '@/services/rate-limit';
import { runMarketAnalysis } from '@/services/analysis';
import { DEFAULT_COMPETITOR_TYPES, isCompetitorType, type CompetitorType } from '@/lib/competitor-types';
import type { CnaeOption } from '@/lib/types';

const cnaeSchema = z.object({
  codigo: z.string().optional().default(''),
  descricao: z.string().min(1),
  tipo: z.enum(['Principal', 'Secundário']).optional().default('Secundário')
});

const schema = z.object({
  unidade: z.any(),
  ceps: z.array(z.string()).optional().default([]),
  selectedCnaes: z.array(cnaeSchema).optional().default([]),
  competitorTypes: z.array(z.string()).optional().default(DEFAULT_COMPETITOR_TYPES).transform((items) => items.filter(isCompetitorType) as CompetitorType[]),
  analysisRadiusKm: z.coerce.number().min(1).max(50).optional().default(8),
  // Campos legados aceitos para não quebrar relatórios/cliente antigo.
  competitorType: z.string().optional(),
  domain: z.string().optional()
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    await assertUserRateLimit(userId);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const radiusIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'analysisRadiusKm');
      if (radiusIssue) {
        return NextResponse.json({ error: 'O raio de análise deve ficar entre 1 e 50 km. Ajuste o campo e tente novamente.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Alguns dados enviados estão em formato inválido. Revise o formulário e tente novamente.' }, { status: 400 });
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
      selectedCnaes: body.selectedCnaes as CnaeOption[],
      competitorTypes,
      analysisRadiusKm: body.analysisRadiusKm
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao processar análise.' }, { status: 400 });
  }
}
