// Este arquivo cria o cliente do Prisma, que e a ponte entre o codigo e o banco PostgreSQL.
// Em desenvolvimento reaproveitamos a conexao para evitar abrir conexoes demais ao salvar arquivos.
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
