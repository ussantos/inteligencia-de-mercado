// Esta API apaga um arquivo temporario que foi enviado para o Azure Blob Storage.
// Ela e chamada depois que a analise termina, porque a aplicacao ja extraiu os CEPs no navegador.
import { NextResponse } from 'next/server';
import { deleteUploadedBlob } from '@/services/blob';

export async function POST(request: Request) {
  try {
    const { blobName } = await request.json();
    if (!blobName) return NextResponse.json({ error: 'Nome do arquivo temporário não informado.' }, { status: 400 });
    const data = await deleteUploadedBlob(String(blobName));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível apagar o arquivo temporário.' }, { status: 400 });
  }
}
