import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { DebounceService } from '../notification/debounce.service';
import { NotificationService } from '../notification/notification.service';
import type { ReportData } from '../../types';

/**
 * 设备上报服务
 * 处理设备数据上报和心跳，包含防抖去重和异步通知触发
 */
export class ReportService {
  /**
   * 处理设备数据上报
   * 1. 解析 Header（device_token 优先，activation_code fallback）
   * 2. 更新设备状态
   * 3. status==="presence" 时触发防抖检查
   * 4. 防抖通过→创建alarm事件→异步推送通知
   * 5. 防抖不通过→静默丢弃
   * @param deviceToken 设备 token（优先）
   * @param activationCode 激活码（fallback）
   * @param data 上报数据
   */
  async handleReport(
    deviceToken: string | undefined,
    activationCode: string | undefined,
    data: ReportData,
  ): Promise<{ message: string }> {
    
    const device = await this.validateDevice(deviceToken, activationCode);

    if (!device) {
      const error = new Error('设备未授权');
      (error as any).code = 2005;
      (error as any).statusCode = 401;
      throw error;
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        last_report_at: new Date(),
        status: 'online',
        last_heartbeat_at: new Date(),
      },
    });

    if (data.status !== 'presence') {
      return { message: '上报成功' };
    }

    const config = await prisma.deviceConfig.findUnique({
      where: { device_id: device.id },
    });

    const debounceInterval = config?.debounce_interval ?? 30;

    const shouldTrigger = await DebounceService.shouldTrigger(device.id, debounceInterval);

    if (!shouldTrigger) {
      
      logger.debug({ deviceId: device.id }, 'Report debounced (presence within window)');
      return { message: '上报成功' };
    }

    const rssi = (data.extra?.rssi as number | undefined) ?? (data as any).rssi ?? null;
    const event = await prisma.event.create({
      data: {
        device_id: device.id,
        user_id: device.user_id,
        type: 'alarm',
        detail: {
          message: '人体检测告警',
          report_data: {
            status: data.status,
            timestamp: data.timestamp || Date.now(),
            rssi,
            extra: data.extra || null,
          },
        } as any,
      },
    });

    logger.info({ deviceId: device.id, eventId: event.id }, 'Alarm event created');

    setImmediate(() => {
      NotificationService.dispatch(
        {
          id: device.id,
          name: device.name,
          user_id: device.user_id,
        },
        {
          id: event.id,
          type: event.type,
          detail: event.detail,
          created_at: event.created_at,
        },
      ).catch((err) => {
        logger.error({ err, deviceId: device.id, eventId: event.id }, 'Async notification dispatch failed');
      });
    });

    return { message: '上报成功' };
  }

  /**
   * 处理设备心跳
   * @param deviceToken 设备 token
   * @param data 心跳数据（含 rssi）
   */
  async handleHeartbeat(deviceToken: string | undefined, data: { timestamp?: number; rssi?: number } = {}): Promise<void> {
    if (!deviceToken) {
      const error = new Error('设备未授权');
      (error as any).code = 2005;
      (error as any).statusCode = 401;
      throw error;
    }

    const device = await prisma.device.findUnique({
      where: { device_token: deviceToken },
      select: { id: true, user_id: true, name: true, status: true },
    });

    if (!device) {
      const error = new Error('设备未授权');
      (error as any).code = 2005;
      (error as any).statusCode = 401;
      throw error;
    }

    if (device.status === 'offline') {
      const hbBody = data as any;
      const rssi = hbBody?.rssi ?? null;
      const onlineEvent = await prisma.event.create({
        data: {
          device_id: device.id,
          user_id: device.user_id,
          type: 'online',
          detail: {
            message: '设备重新上线',
            rssi,
          } as any,
        },
      });
      logger.info({ deviceId: device.id, eventId: onlineEvent.id }, 'Device back online event created');
      
      await prisma.deviceConfig.updateMany({
        where: { device_id: device.id },
        data: { last_online_remind_at: null },
      });
      setImmediate(() => {
        NotificationService.dispatch(
          { id: device.id, name: device.name, user_id: device.user_id },
          { id: onlineEvent.id, type: onlineEvent.type, detail: onlineEvent.detail, created_at: onlineEvent.created_at },
        ).catch((err) => {
          logger.error({ err, deviceId: device.id }, 'Online notification dispatch failed');
        });
      });
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        last_heartbeat_at: new Date(),
        status: 'online',
      },
    });

    logger.debug({ deviceId: device.id }, 'Heartbeat received');
  }

  /**
   * 验证设备身份
   * device_token 优先，activation_code fallback
   * @param deviceToken 设备 token
   * @param activationCode 激活码
   * @returns 设备记录（含用户 ID 和名称），未找到返回 null
   */
  private async validateDevice(
    deviceToken: string | undefined,
    activationCode: string | undefined,
  ): Promise<{ id: number; user_id: number; name: string } | null> {
    
    if (deviceToken) {
      const device = await prisma.device.findUnique({
        where: { device_token: deviceToken },
        select: { id: true, user_id: true, name: true },
      });
      return device;
    }

    if (activationCode) {
      const code = await prisma.activationCode.findUnique({
        where: { code: activationCode },
        select: {
          id: true,
          status: true,
          device: {
            select: { id: true, user_id: true, name: true },
          },
        },
      });

      if (!code || code.status !== 'bound' || !code.device) {
        return null;
      }

      return code.device;
    }

    return null;
  }
}

export const reportService = new ReportService();
