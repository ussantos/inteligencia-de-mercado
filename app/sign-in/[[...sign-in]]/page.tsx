import { SignInButton } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold text-orange-600">Inteligência de Mercado</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Acesse a ferramenta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Entre para analisar concorrência, regiões, oportunidades e posicionamento de mercado.
        </p>
        <SignInButton mode="redirect" forceRedirectUrl="/">
          <button className="mt-8 w-full rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600">
            Acessar ferramenta
          </button>
        </SignInButton>
      </div>
    </main>
  );
}
