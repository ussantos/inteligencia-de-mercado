import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

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
