// Esta API cria uma URL temporaria para upload no Azure Blob Storage.
// Assim o navegador consegue enviar o arquivo direto para o storage sem conhecer a connection string secreta.
import { NextResponse } from 'next/server';
import { createUploadSasUrl } from '@/services/blob';

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();
    const data = await createUploadSasUrl(String(fileName || 'upload.xlsx'));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar URL de upload.' }, { status: 400 });
  }
}
