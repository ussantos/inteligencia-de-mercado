// Esta API cria um link de compartilhamento para uma analise ja salva.
// O link ganha um codigo aleatorio e uma data de vencimento, para nao ficar publico para sempre.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { anonymousUserId } from '@/lib/visitor';

export async function POST(request: Request) {
  const userId = anonymousUserId(request);

  try {
    const { analysisId } = await request.json();
    const analysis = await prisma.analysis.findFirst({ where: { id: String(analysisId), userId } });
    if (!analysis) return NextResponse.json({ error: 'Análise não encontrada.' }, { status: 404 });
    if (analysis.reportJson == null) {
      return NextResponse.json({ error: 'A análise não possui dados suficientes para compartilhamento.' }, { status: 400 });
    }

    const ttlDays = Number(process.env.SHARED_LINK_TTL_DAYS || 7);
    const link = await prisma.sharedLink.create({
      data: {
        uuid: crypto.randomUUID(),
        userId,
        analysisId: analysis.id,
        reportJson: analysis.reportJson as any,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
      }
    });

    return NextResponse.json({ url: `/internal/shared/${link.uuid}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao compartilhar análise.' }, { status: 400 });
  }
}
