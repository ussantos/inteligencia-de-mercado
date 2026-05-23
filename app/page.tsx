import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-200">
          Ferramenta interna em testes
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Análise de Concorrência
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Ferramenta de análise de concorrência para cursos extracurriculares, ainda em fase de testes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/internal/market-intelligence" className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600">
            Acessar ferramenta
          </Link>
        </div>
      </section>
    </main>
  );
}
