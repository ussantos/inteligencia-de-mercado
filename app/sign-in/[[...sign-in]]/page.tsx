// Esta e a tela de entrada.
// Ela renderiza o formulario do Clerk dentro do proprio site, evitando ir para o Account Portal externo.
// Depois do login, a pessoa volta para a raiz "/", onde fica a ferramenta.
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] lg:grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-slate-900 p-6">
              <img
                src="https://www.myrobotbarra.com.br/assets/images/course-logos/inteligencia-artificial.webp"
                alt="Curso de Inteligência Artificial da My Robot Barra da Tijuca"
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
            </div>
            <div className="flex flex-col justify-center p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-400">Projeto aplicado</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">Inteligência de mercado com IA na prática</h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Esta ferramenta foi criada aplicando conceitos ensinados no curso de Inteligência Artificial da My Robot Barra da Tijuca.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                A proposta é mostrar como IA, dados públicos e automação podem apoiar decisões reais sobre concorrência, região, posicionamento e próximos passos comerciais.
              </p>
              <a
                href="https://www.myrobotbarra.com.br/inteligencia-artificial.html"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex w-fit items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Conhecer o curso
              </a>
            </div>
          </div>
        </section>

        <div className="w-full rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-orange-600">Inteligência de Mercado</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Acesse a ferramenta</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Entre para analisar concorrência, regiões, oportunidades e posicionamento de mercado.
          </p>
          <div className="mt-8 flex justify-center">
            <SignIn routing="path" path="/sign-in" forceRedirectUrl="/" />
          </div>
        </div>
      </div>
    </main>
  );
}
