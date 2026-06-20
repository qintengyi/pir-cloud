import { PrismaClient } from '@prisma/client';
import { config } from './index';

/**
 * Prisma Client 单例
 * 避免在开发模式下频繁创建连接导致连接池耗尽
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
