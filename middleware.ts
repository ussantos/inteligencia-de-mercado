// O middleware roda antes das paginas serem abertas.
// Ele funciona como um porteiro: decide quais caminhos sao publicos e quais exigem login.
// A raiz "/" fica protegida; login, APIs, relatorios compartilhados e a saude do Azure precisam ficar acessiveis.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/internal/shared(.*)', '/api(.*)', '/.swa(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.swa|_next|.*\\..*).*)']
};
