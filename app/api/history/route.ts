// Esta API lista analises antigas do visitante anonimo.
// Sem login, o historico e separado por um identificador local enviado pelo navegador.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { anonymousUserId } from '@/lib/visitor';

export async function GET(request: Request) {
  const userId = anonymousUserId(request);

  const history = await prisma.analysisHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      businessUnitCnpj: true,
      businessUnitCep: true,
      businessUnitName: true,
      domain: true,
      cepCount: true,
      opportunityIndex: true
    }
  });

  return NextResponse.json({ history });
}
