import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { config } from '../config/index';

/**
 * 数据清理定时任务
 * 每日凌晨 3:00 执行，清理过期数据
 */

/**
 * 执行数据清理
 */
async function runCleanup(): Promise<void> {
  logger.info('Starting data cleanup job...');

  const retentionDate = new Date(Date.now() - config.dataRetentionDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  try {
    
    const deletedEvents = await prisma.event.deleteMany({
      where: {
        created_at: { lt: retentionDate },
      },
    });
    logger.info({ count: deletedEvents.count, retentionDays: config.dataRetentionDays }, 'Expired events cleaned');

    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: {
        expires_at: { lt: now },
      },
    });
    logger.info({ count: deletedTokens.count }, 'Expired refresh tokens cleaned');

    const deletedCodes = await prisma.verificationCode.deleteMany({
      where: {
        expires_at: { lt: now },
      },
    });
    logger.info({ count: deletedCodes.count }, 'Expired verification codes cleaned');

    logger.info('Data cleanup job completed');
  } catch (err) {
    logger.error({ err }, 'Cleanup job failed');
  }
}

/**
 * 注册数据清理定时任务
 * 每日凌晨 3:00 执行
 */
export function registerCleanupJob(): void {
  cron.schedule('0 3 * * *', () => {
    runCleanup().catch((err) => {
      logger.error({ err }, 'Cleanup job unexpected error');
    });
  });

  logger.info('Cleanup job registered (daily at 3:00 AM)');
}
