// Esta e a tela de entrada.
// Ela renderiza o formulario do Clerk dentro do proprio site, evitando ir para o Account Portal externo.
// Depois do login, a pessoa volta para a raiz "/", onde fica a ferramenta.
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-xl">
          <div className="flex min-h-[520px] flex-col p-8">
            <div className="flex justify-center">
              <img
                src="https://www.myrobotbarra.com.br/assets/images/course-logos/inteligencia-artificial.webp"
                alt="Curso de Inteligência Artificial da My Robot Barra da Tijuca"
                className="h-auto max-h-24 w-full max-w-sm rounded-2xl bg-white object-contain px-4 py-2 shadow-[0_14px_45px_rgba(15,23,42,0.12)]"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-fuchsia-100 px-4 py-2 text-sm font-semibold text-fuchsia-800">Projeto aplicado</span>
              <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">IA generativa</span>
            </div>

            <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">Inteligência de mercado com IA na prática</h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Esta ferramenta foi criada aplicando conceitos ensinados no curso de Inteligência Artificial da My Robot Barra da Tijuca.
            </p>
            <p className="mt-3 text-base leading-7 text-slate-700">
              A proposta é mostrar como IA, dados públicos e automação podem apoiar decisões reais sobre concorrência, região, posicionamento e próximos passos comerciais.
            </p>

            <div className="mt-6 flex flex-1 items-end justify-center">
              <img
                src="https://www.myrobotbarra.com.br/assets/images/robos/luiza.webp"
                alt="Robô Luiza"
                className="h-auto max-h-60 w-auto object-contain drop-shadow-[0_22px_35px_rgba(15,23,42,0.16)]"
              />
            </div>

            <a
              href="https://www.myrobotbarra.com.br/inteligencia-artificial.html"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-fit items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              Conhecer o curso
            </a>
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
