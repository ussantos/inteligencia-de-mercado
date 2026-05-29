// Esta API recebe a planilha do navegador e envia para o Azure Blob Storage pelo servidor.
// Isso evita erro de CORS, porque quem conversa com o Azure Storage e a API Next.js, nao o navegador.
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadTemporaryBlob } from '@/services/blob';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo maior que o limite permitido de 50MB.' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const data = await uploadTemporaryBlob(file.name || 'upload.xlsx', file.type || 'application/octet-stream', new Uint8Array(buffer));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o arquivo temporário.' }, { status: 400 });
  }
}
