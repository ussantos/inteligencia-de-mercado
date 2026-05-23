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
    const body = schema.parse(await request.json());
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
