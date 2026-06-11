// Esta API recebe um CEP e devolve endereco, bairro, cidade e UF pelo ViaCEP.
// Ela ajuda o formulario a preencher dados de localizacao sem expor detalhes internos no navegador.
import { NextResponse } from 'next/server';
import { isValidCep, normalizeCep } from '@/lib/cep';
import { getViaCep } from '@/services/viacep';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cep = normalizeCep(String(body.cep || ''));

    if (!isValidCep(cep)) {
      return NextResponse.json({ error: 'Informe um CEP válido com 8 dígitos.' }, { status: 400 });
    }

    const address = await getViaCep(cep);
    if (!address) {
      return NextResponse.json({ error: 'CEP não encontrado no ViaCEP.' }, { status: 404 });
    }

    return NextResponse.json({
      cep,
      logradouro: address.logradouro || '',
      bairro: address.bairro || '',
      cidade: address.localidade || '',
      uf: address.uf || ''
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar CEP.' }, { status: 400 });
  }
}
