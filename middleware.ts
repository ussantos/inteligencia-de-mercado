// O site agora e publico: a pessoa cai direto no formulario.
// Mantemos um middleware minimo para preservar a estrutura do Next/Azure sem exigir login.
import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.swa|_next|.*\\..*).*)']
};
