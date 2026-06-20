import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from '../modules/notification/notification.service';

/**
 * 持续在线提醒定时任务
 * 每 1 分钟扫描启用了"持续在线提醒"且当前在线的设备，
 * 当持续在线时长达到用户自定义间隔时，创建提醒事件并推送通知，
 * 随后重置 last_online_remind_at 作为下一轮周期的起点。
 *
 * 持续在线起点取值优先级：
 *   1) device_config.last_online_remind_at（上一次提醒时间）
 *   2) 设备最近一次 online 事件的 created_at
 *   3) 若仍无起点则跳过本轮，等待配置接口或后续上线事件初始化
 */

/** 扫描间隔：每 1 分钟 */
const CRON_EXPR = '* * * * *';

/**
 * 执行持续在线提醒扫描
 */
async function checkOnlineRemind(): Promise<void> {
  const now = new Date();

  try {

    const devices = await prisma.device.findMany({
      where: {
        status: 'online',
        config: {
          is: {
            online_remind_enabled: true,
          },
        },
      },
      include: {
        config: true,
      },
    });

    if (devices.length === 0) {
      return;
    }

    for (const device of devices) {
      await maybeRemind(device, now);
    }
  } catch (err) {
    logger.error({ err }, 'Online remind job failed');
  }
}

/**
 * 判断单台设备是否需要发送在线提醒
 */
async function maybeRemind(
  device: {
    id: number;
    user_id: number;
    name: string;
    config: { online_remind_interval_minutes: number; last_online_remind_at: Date | null } | null;
  },
  now: Date,
): Promise<void> {
  const cfg = device.config;
  if (!cfg) return;

  const intervalMs = cfg.online_remind_interval_minutes * 60 * 1000;

  let startPoint = cfg.last_online_remind_at;

  if (!startPoint) {
    const lastOnlineEvent = await prisma.event.findFirst({
      where: { device_id: device.id, type: 'online' },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    startPoint = lastOnlineEvent?.created_at ?? null;
  }

  if (!startPoint) {
    return;
  }

  const elapsed = now.getTime() - startPoint.getTime();
  if (elapsed < intervalMs) {
    return;
  }

  const onlineMinutes = Math.floor(elapsed / (60 * 1000));

  try {

    const event = await prisma.event.create({
      data: {
        device_id: device.id,
        user_id: device.user_id,
        type: 'online',
        detail: {
          message: '设备持续在线提醒',
          subtype: 'online_remind',
          online_minutes: onlineMinutes,
        } as any,
      },
    });

    await prisma.deviceConfig.update({
      where: { device_id: device.id },
      data: { last_online_remind_at: now },
    });

    logger.info(
      { deviceId: device.id, deviceName: device.name, onlineMinutes },
      'Online remind triggered',
    );

    setImmediate(() => {
      NotificationService.dispatch(
        { id: device.id, name: device.name, user_id: device.user_id },
        { id: event.id, type: event.type, detail: event.detail, created_at: event.created_at },
      ).catch((err) => {
        logger.error({ err, deviceId: device.id }, 'Online remind notification dispatch failed');
      });
    });
  } catch (err) {
    logger.error({ err, deviceId: device.id }, 'Failed to create online remind event');
  }
}

/**
 * 注册持续在线提醒定时任务
 */
export function registerOnlineRemindJob(): void {
  cron.schedule(CRON_EXPR, () => {
    checkOnlineRemind().catch((err) => {
      logger.error({ err }, 'Online remind job unexpected error');
    });
  });

  logger.info('Online remind job registered (every minute)');
}