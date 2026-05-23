import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Dashboard } from '@/components/Dashboard';
import type { AnalysisResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SharedAnalysisPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const link = await prisma.sharedLink.findUnique({ where: { uuid } });

  if (!link || link.expiresAt < new Date()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Relatório compartilhado</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Inteligência de Mercado — My Robot</h1>
          <p className="mt-2 text-sm text-slate-500">Link somente leitura com validade limitada.</p>
        </div>
        <Dashboard result={link.reportJson as unknown as AnalysisResult} readOnly />
      </div>
    </main>
  );
}
