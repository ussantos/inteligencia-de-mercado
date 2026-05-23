import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createUploadSasUrl } from '@/services/blob';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const { fileName } = await request.json();
    const data = await createUploadSasUrl(String(fileName || 'upload.xlsx'));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar URL de upload.' }, { status: 400 });
  }
}
