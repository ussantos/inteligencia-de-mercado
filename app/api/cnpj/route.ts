import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCnpjData } from '@/services/cnpj';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const body = await request.json();
    const unidade = await getCnpjData(String(body.cnpj || ''));
    return NextResponse.json({ unidade });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar CNPJ.' }, { status: 400 });
  }
}
