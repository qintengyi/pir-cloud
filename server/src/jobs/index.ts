import { registerHeartbeatJob } from './heartbeat.job';
import { registerCleanupJob } from './cleanup.job';
import { registerOnlineRemindJob } from './onlineRemind.job';
import { logger } from '../utils/logger';

/**
 * 注册所有定时任务
 * 在应用启动时调用
 */
export function registerJobs(): void {
  logger.info('Registering cron jobs...');

  registerHeartbeatJob();

  registerCleanupJob();

  registerOnlineRemindJob();

  logger.info('All cron jobs registered successfully');
}
