// Este arquivo limita quantas analises um usuario pode fazer por hora.
// Isso evita abuso, gasto inesperado com APIs externas e sobrecarga do banco.
import { prisma } from '@/lib/prisma';

export async function assertUserRateLimit(userId: string) {
  const limit = Number(process.env.ANALYSIS_RATE_LIMIT_PER_HOUR || 10);
  const now = new Date();
  const windowKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;

  const record = await prisma.userRateLimit.upsert({
    where: { userId_windowKey: { userId, windowKey } },
    update: { count: { increment: 1 } },
    create: { userId, windowKey, count: 1 }
  });

  if (record.count > limit) {
    throw new Error(`Limite de ${limit} análises por hora atingido. Tente novamente mais tarde.`);
  }
}
