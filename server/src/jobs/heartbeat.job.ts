import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { config } from '../config/index';
import { NotificationService } from '../modules/notification/notification.service';

/**
 * 心跳检测定时任务
 * 每分钟扫描超过 5 分钟未心跳的在线设备，标记为离线并创建事件
 */

/**
 * 执行心跳检测
 */
async function checkOfflineDevices(): Promise<void> {
  const timeoutThreshold = new Date(Date.now() - config.heartbeatTimeoutSeconds * 1000);

  try {
    
    const timeoutDevices = await prisma.device.findMany({
      where: {
        status: 'online',
        last_heartbeat_at: {
          lt: timeoutThreshold,
        },
      },
      select: { id: true, user_id: true, name: true },
    });

    if (timeoutDevices.length === 0) {
      return;
    }

    logger.info({ count: timeoutDevices.length }, 'Found offline devices (heartbeat timeout)');

    for (const device of timeoutDevices) {
      await markOffline(device.id, device.user_id, device.name);
    }
  } catch (err) {
    logger.error({ err }, 'Heartbeat job failed');
  }
}

/**
 * 标记设备为离线并创建事件
 * @param deviceId 设备 ID
 * @param userId 用户 ID
 * @param deviceName 设备名称
 */
async function markOffline(deviceId: number, userId: number, deviceName: string): Promise<void> {
  try {
    
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'offline' },
    });

    const event = await prisma.event.create({
      data: {
        device_id: deviceId,
        user_id: userId,
        type: 'offline',
        detail: {
          message: '设备心跳超时，自动标记为离线',
          device_name: deviceName,
        } as any,
      },
    });

    logger.info({ deviceId, deviceName }, 'Device marked as offline (heartbeat timeout)');

    setImmediate(() => {
      NotificationService.dispatch(
        { id: deviceId, name: deviceName, user_id: userId },
        { id: event.id, type: event.type, detail: event.detail, created_at: event.created_at },
      ).catch((err) => {
        logger.error({ err, deviceId }, 'Offline notification dispatch failed');
      });
    });
  } catch (err) {
    logger.error({ err, deviceId }, 'Failed to mark device offline');
  }
}

/**
 * 注册心跳检测定时任务
 * 每分钟执行一次
 */
export function registerHeartbeatJob(): void {
  cron.schedule('* * * * *', () => {
    checkOfflineDevices().catch((err) => {
      logger.error({ err }, 'Heartbeat job unexpected error');
    });
  });

  logger.info('Heartbeat job registered (every minute)');
}
