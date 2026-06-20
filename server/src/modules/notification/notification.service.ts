import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { EmailService } from './email.service';
import { OneBotService } from './onebot.service';
import type { NotifyChannel } from '../../types';

/**
 * 通知调度服务
 * 负责根据设备配置调度告警通知到各渠道（邮件、QQ机器人）
 * QQ 失败时降级到邮箱通知
 */

interface DeviceInfo {
  id: number;
  name: string;
  user_id: number;
}

interface EventInfo {
  id: number;
  type: string;
  detail: any;
  created_at: Date;
}

interface DeviceConfigInfo {
  notify_enabled: boolean;
  debounce_interval: number;
  notify_channels: string[];
}

class NotificationServiceClass {
  /**
   * 分发告警通知
   * 根据设备配置决定是否通知、通过哪些渠道通知
   * @param device 设备信息
   * @param event 事件信息
   */
  async dispatch(device: DeviceInfo, event: EventInfo): Promise<void> {
    try {

      const config = await prisma.deviceConfig.findUnique({
        where: { device_id: device.id },
      });

      if (!config) {
        logger.warn({ deviceId: device.id }, 'Device config not found, skipping notification');
        return;
      }

      if (!config.notify_enabled) {
        logger.debug({ deviceId: device.id }, 'Notification disabled for this device');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: device.user_id },
        select: {
          email: true,
          qq_number: true,
          membership_level: true,
          membership_expire_at: true,
        },
      });

      if (!user) {
        logger.warn({ userId: device.user_id }, 'User not found, skipping notification');
        return;
      }

      const isPremium =
        user.membership_level === 'premium' &&
        (!user.membership_expire_at || user.membership_expire_at > new Date());

      const channels = config.notify_channels as NotifyChannel[];

      for (const channel of channels) {
        if (channel === 'email') {
          await this.sendEmailNotification(user.email, device, event);
        } else if (channel === 'qq_bot') {

          if (!isPremium) {
            logger.info({ userId: device.user_id }, 'User is not premium, skipping QQ notification');
            continue;
          }

          if (!user.qq_number) {
            logger.info({ userId: device.user_id }, 'User has no QQ number bound, skipping QQ notification');
            continue;
          }

          const qqSuccess = await this.sendQQNotification(user.qq_number, device, event);

          if (!qqSuccess) {
            logger.warn({ deviceId: device.id }, 'QQ notification failed, falling back to email');
            await this.sendEmailNotification(user.email, device, event);
          }
        }
      }
    } catch (err) {

      logger.error({ err, deviceId: device.id, eventId: event.id }, 'Notification dispatch failed');
    }
  }

  /**
   * 发送邮件通知
   * @param email 用户邮箱
   * @param device 设备信息
   * @param event 事件信息
   */
  private async sendEmailNotification(
    email: string,
    device: DeviceInfo,
    event: EventInfo,
  ): Promise<void> {

    if (event.detail?.subtype === 'online_remind') {
      const onlineMinutes = event.detail?.online_minutes ?? 0;
      const result = await EmailService.sendOnlineRemindEmail(email, device.name, event.created_at, onlineMinutes);
      if (result.success) {
        logger.info({ email, deviceId: device.id }, 'Online remind email sent successfully');
      } else {
        logger.error({ email, deviceId: device.id, error: result.error }, 'Online remind email send failed');
      }
      return;
    }

    const alarmType = '人体检测告警';
    const result = await EmailService.sendAlarmEmail(email, device.name, event.created_at, alarmType);

    if (result.success) {
      logger.info({ email, deviceId: device.id }, 'Alarm email sent successfully');
    } else {
      logger.error({ email, deviceId: device.id, error: result.error }, 'Alarm email send failed');
    }
  }

  /**
   * 将 RSSI(dBm) 转换为信号强度百分比（0-100）
   * ESP8266 RSSI 通常 -40(极好) ~ -90(极差)
   */
  private rssiToPercent(rssi: number | undefined | null): number {
    if (rssi === undefined || rssi === null) return 0;
    if (rssi >= -50) return 100;
    if (rssi <= -90) return 0;
    return Math.round(((rssi - (-90)) / ((-50) - (-90))) * 100);
  }

  /**
   * 发送 QQ 通知
   * 文案格式：[有人/上线/下线]\n设备:xxx\n时间:xxx\nWiFi强度:xx%\n   * 持续在线提醒：[心跳]\n设备:xxx\n时间:xxx
   * @param qqNumber QQ 号
   * @param device 设备信息
   * @param event 事件信息
   * @returns 是否发送成功
   */
  private async sendQQNotification(
    qqNumber: string,
    device: DeviceInfo,
    event: EventInfo,
  ): Promise<boolean> {
    const formattedTime = event.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    if (event.detail?.subtype === 'online_remind') {
      const remindMessage = `[心跳]\n设备:${device.name}\n时间:${formattedTime}`;
      return OneBotService.sendMessage(qqNumber, remindMessage);
    }

    const tag =
      event.type === 'alarm' ? '有人' :
      event.type === 'online' ? '上线' :
      event.type === 'offline' ? '下线' : '通知';
    const rssi = event.detail?.report_data?.rssi ?? event.detail?.rssi ?? null;
    const message = `[${tag}]\n设备:${device.name}\n时间:${formattedTime}\nWiFi强度:${this.rssiToPercent(rssi)}%`;

    return OneBotService.sendMessage(qqNumber, message);
  }
}

export const NotificationService = new NotificationServiceClass();
