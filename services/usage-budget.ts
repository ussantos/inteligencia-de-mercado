// Este arquivo controla um limite mensal simples para APIs externas.
// A ideia e ficar abaixo do limite gratis configurado pelo dono do projeto, por exemplo 60% do free tier.
// Ele reaproveita a tabela UserRateLimit para evitar criar nova migracao de banco.
import { prisma } from '@/lib/prisma';

export type UsageBudgetProvider = 'GOOGLE_PLACES' | 'LOCATIONIQ' | 'ORS' | 'OPENAI' | 'CNPJ_PUBLIC' | 'VIACEP' | 'NOMINATIM' | 'OVERPASS';

const SYSTEM_BUDGET_USER_ID = '__system_monthly_budget__';

const PROVIDER_LABELS: Record<UsageBudgetProvider, string> = {
  GOOGLE_PLACES: 'Google Places',
  LOCATIONIQ: 'LocationIQ',
  ORS: 'OpenRouteService',
  OPENAI: 'OpenAI',
  CNPJ_PUBLIC: 'fontes públicas de CNPJ',
  VIACEP: 'ViaCEP',
  NOMINATIM: 'Nominatim',
  OVERPASS: 'Overpass'
};

function readPositiveNumber(envName: string) {
  const value = process.env[envName];
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function monthKey(date = new Date()) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

export function monthlyBudgetLimit(provider: UsageBudgetProvider) {
  // Existem dois jeitos de configurar:
  // 1. Definir o limite direto, como GOOGLE_PLACES_MONTHLY_BUDGET=3000.
  // 2. Definir o free tier, como GOOGLE_PLACES_MONTHLY_FREE_QUOTA=5000, e MONTHLY_BUDGET_PERCENT=60.
  const directBudget = readPositiveNumber(`${provider}_MONTHLY_BUDGET`);
  if (directBudget) return Math.floor(directBudget);

  const freeQuota = readPositiveNumber(`${provider}_MONTHLY_FREE_QUOTA`);
  if (!freeQuota) return null;

  const percent = readPositiveNumber('MONTHLY_BUDGET_PERCENT') ?? 60;
  const safePercent = Math.min(100, Math.max(1, percent));
  return Math.floor((freeQuota * safePercent) / 100);
}

export async function assertMonthlyBudget(provider: UsageBudgetProvider, units = 1) {
  // MONTHLY_BUDGET_ENABLED=false desliga esse freio sem remover as variaveis do ambiente.
  if (process.env.MONTHLY_BUDGET_ENABLED === 'false') return;

  const limit = monthlyBudgetLimit(provider);
  if (!limit) return;

  const safeUnits = Math.max(1, Math.ceil(units));
  const windowKey = `monthly:${provider}:${monthKey()}`;
  const current = await prisma.userRateLimit.findUnique({
    where: { userId_windowKey: { userId: SYSTEM_BUDGET_USER_ID, windowKey } }
  });
  const used = current?.count ?? 0;

  if (used + safeUnits > limit) {
    throw new Error(`Limite mensal configurado para ${PROVIDER_LABELS[provider]} atingido (${used}/${limit}). A chamada foi bloqueada para manter o uso abaixo do orçamento definido nas variáveis de ambiente.`);
  }

  await prisma.userRateLimit.upsert({
    where: { userId_windowKey: { userId: SYSTEM_BUDGET_USER_ID, windowKey } },
    update: { count: { increment: safeUnits } },
    create: { userId: SYSTEM_BUDGET_USER_ID, windowKey, count: safeUnits }
  });
}
