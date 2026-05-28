// O middleware roda antes das paginas serem abertas.
// Ele funciona como um porteiro: decide quais caminhos sao publicos e quais exigem login.
// A raiz "/" fica protegida; login, APIs e relatorios compartilhados precisam ficar acessiveis sem bloquear o fluxo.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/internal/shared(.*)', '/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
};
