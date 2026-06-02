// Esta API recebe um CNPJ e devolve dados da empresa encontrados em fontes publicas.
// Ela deixa a tela mais simples: o navegador pergunta ao nosso servidor, e o servidor conversa com os servicos externos.
import { NextResponse } from 'next/server';
import { getCnpjData } from '@/services/cnpj';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const unidade = await getCnpjData(String(body.cnpj || ''));
    return NextResponse.json({ unidade });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar CNPJ.' }, { status: 400 });
  }
}
