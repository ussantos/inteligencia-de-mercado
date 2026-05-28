// Esta e a tela de entrada.
// Ela renderiza o formulario do Clerk dentro do proprio site, evitando ir para o Account Portal externo.
// Depois do login, a pessoa volta para a raiz "/", onde fica a ferramenta.
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold text-orange-600">Inteligência de Mercado</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Acesse a ferramenta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Entre para analisar concorrência, regiões, oportunidades e posicionamento de mercado.
        </p>
        <div className="mt-8 flex justify-center">
          <SignIn routing="path" path="/sign-in" forceRedirectUrl="/" />
        </div>
      </div>
    </main>
  );
}
