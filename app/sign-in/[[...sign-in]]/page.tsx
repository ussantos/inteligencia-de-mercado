// Esta e a tela de entrada.
// Ela renderiza o formulario do Clerk dentro do proprio site, evitando ir para o Account Portal externo.
// Depois do login, a pessoa volta para a raiz "/", onde fica a ferramenta.
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[460px_1fr]">
        <div className="w-full rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-orange-600">Inteligência de Mercado</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Ferramenta para Análise de Mercado</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Projeto educativo criado para aplicar conceitos dos cursos Inteligência Artificial e App Developer da My Robot Barra da Tijuca. O código está disponível no GitHub sob licença{' '}
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer" className="font-semibold text-orange-700 underline underline-offset-2">GNU GPL</a>{' '}
            em{' '}
            <a href="https://github.com/ussantos/inteligencia-de-mercado" target="_blank" rel="noreferrer" className="font-semibold text-orange-700 underline underline-offset-2">ussantos/inteligencia-de-mercado</a>.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Em atenção à LGPD, a ferramenta usa apenas os dados necessários para a análise e ignora dados pessoais que não sejam relevantes ao estudo regional.
          </p>
          <div className="mt-8 flex justify-center">
            <SignIn routing="path" path="/sign-in" forceRedirectUrl="/" />
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-xl">
          <div className="flex min-h-[520px] flex-col p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-h-28 items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-[0_14px_45px_rgba(15,23,42,0.12)]">
                <img
                  src="https://www.myrobotbarra.com.br/assets/images/course-logos/inteligencia-artificial.webp"
                  alt="Curso de Inteligência Artificial da My Robot Barra da Tijuca"
                  className="h-auto max-h-20 w-full object-contain"
                />
              </div>
              <div className="flex min-h-28 items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-[0_14px_45px_rgba(15,23,42,0.12)]">
                <img
                  src="https://www.myrobotbarra.com.br/assets/images/course-logos/appdeveloper.webp"
                  alt="Curso App Developer da My Robot Barra da Tijuca"
                  className="h-auto max-h-20 w-full object-contain"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-fuchsia-100 px-4 py-2 text-sm font-semibold text-fuchsia-800">Projeto aplicado</span>
              <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">IA generativa</span>
              <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">Desenvolvimento web</span>
            </div>

            <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">Inteligência de mercado com IA e desenvolvimento na prática</h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Esta ferramenta foi criada aplicando conceitos apresentados nos cursos Inteligência Artificial e App Developer da My Robot Barra da Tijuca.
            </p>
            <p className="mt-3 text-base leading-7 text-slate-700">
              A proposta é mostrar, em caráter educativo, como IA, dados públicos, automação e desenvolvimento web podem apoiar decisões reais sobre concorrência, região, posicionamento e próximos passos comerciais.
            </p>

            <div className="mt-6 grid flex-1 items-end justify-center gap-6 sm:grid-cols-2">
              <img
                src="https://www.myrobotbarra.com.br/assets/images/robos/luiza.webp"
                alt="Robô Luiza"
                className="mx-auto h-auto max-h-56 w-auto object-contain drop-shadow-[0_22px_35px_rgba(15,23,42,0.16)]"
              />
              <img
                src="https://www.myrobotbarra.com.br/assets/images/robos/nicolai.webp"
                alt="Robô Nicolai"
                className="mx-auto h-auto max-h-56 w-auto object-contain drop-shadow-[0_22px_35px_rgba(15,23,42,0.16)]"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://www.myrobotbarra.com.br/inteligencia-artificial.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Conhecer Inteligência Artificial
              </a>
              <a
                href="https://www.myrobotbarra.com.br/app-developer.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Conhecer App Developer
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
