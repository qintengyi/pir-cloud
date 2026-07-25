import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { DebounceService } from '../notification/debounce.service';
import { NotificationService } from '../notification/notification.service';
import type { ReportData } from '../../types';

/**
 * 设备上报服务
 * 处理设备数据上报和心跳，包含防抖去重和异步通知触发
 */
const STABLE_WARMUP_MS = 3 * 60 * 1000;

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

    const config = await prisma.deviceConfig.findUnique({
      where: { device_id: device.id },
    });

    if (config?.stable_after_online_enabled && data.status === 'absence') {
      await prisma.deviceConfig.update({
        where: { device_id: device.id },
        data: {
          stable_warmup_started_at: new Date(),
          stable_warmup_completed_at: null,
        },
      });
      logger.debug({ deviceId: device.id }, 'Stable push warmup refreshed by absence report');
      return { message: '正在预热，已屏蔽推送' };
    }

    if (data.status !== 'presence') {
      return { message: '上报成功' };
    }

    if (config?.stable_after_online_enabled) {
      const warmupResult = await this.checkStableWarmup(device, config);
      if (warmupResult === 'warming') {
        return { message: '正在预热，已屏蔽推送' };
      }
    }

    const debounceInterval = config?.debounce_interval ?? 30;

    const shouldTrigger = await DebounceService.shouldTrigger(device.id, debounceInterval);

    if (!shouldTrigger) {
      
      logger.debug({ deviceId: device.id }, 'Report debounced (presence within window)');
      return { message: '上报成功' };
    }

    const rssi = (data.extra?.rssi as number | undefined) ?? (data as any).rssi ?? null;
    const alarmMessage = device.device_type === 'microwave'
      ? '微波人体检测告警'
      : '红外人体检测告警';
    const event = await prisma.event.create({
      data: {
        device_id: device.id,
        user_id: device.user_id,
        type: 'alarm',
        detail: {
          message: alarmMessage,
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
          device_type: device.device_type,
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
   * 检查稳定后推送模式预热状态。
   * presence 上报时：未满 3 分钟则屏蔽；首次满 3 分钟时推送预热完成通知。
   */
  private async checkStableWarmup(
    device: { id: number; user_id: number; name: string; device_type: string },
    config: { stable_warmup_started_at: Date | null; stable_warmup_completed_at: Date | null },
  ): Promise<'warming' | 'ready'> {
    if (!config.stable_warmup_started_at) {
      return 'ready';
    }

    const now = new Date();
    const elapsed = now.getTime() - config.stable_warmup_started_at.getTime();
    if (elapsed < STABLE_WARMUP_MS) {
      logger.debug({ deviceId: device.id, elapsed }, 'Stable push warmup active, presence suppressed');
      return 'warming';
    }

    if (!config.stable_warmup_completed_at) {
      const event = await prisma.event.create({
        data: {
          device_id: device.id,
          user_id: device.user_id,
          type: 'online',
          detail: {
            message: '稳定后推送模式预热完成',
            subtype: 'stable_warmup_complete',
            warmup_seconds: Math.floor(elapsed / 1000),
          } as any,
        },
      });

      await prisma.deviceConfig.update({
        where: { device_id: device.id },
        data: { stable_warmup_completed_at: now },
      });

      setImmediate(() => {
        NotificationService.dispatch(
          { id: device.id, name: device.name, user_id: device.user_id, device_type: device.device_type },
          { id: event.id, type: event.type, detail: event.detail, created_at: event.created_at },
        ).catch((err) => {
          logger.error({ err, deviceId: device.id }, 'Stable warmup notification dispatch failed');
        });
      });
    }

    return 'ready';
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
      select: { id: true, user_id: true, name: true, status: true, device_type: true },
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

      // 设备重新上线时，若稳定后推送模式开启，重置预热状态（以本次上线时刻作为预热起点）
      const onlineCfg = await prisma.deviceConfig.findUnique({
        where: { device_id: device.id },
        select: { stable_after_online_enabled: true },
      });
      if (onlineCfg?.stable_after_online_enabled) {
        await prisma.deviceConfig.update({
          where: { device_id: device.id },
          data: {
            stable_warmup_started_at: new Date(),
            stable_warmup_completed_at: null,
          },
        });
        logger.info({ deviceId: device.id }, 'Stable push warmup reset on device online');
      }

      setImmediate(() => {
        NotificationService.dispatch(
          { id: device.id, name: device.name, user_id: device.user_id, device_type: device.device_type },
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
   * @returns 设备记录（含用户 ID、名称和设备类型），未找到返回 null
   */
  private async validateDevice(
    deviceToken: string | undefined,
    activationCode: string | undefined,
  ): Promise<{ id: number; user_id: number; name: string; device_type: string } | null> {

    if (deviceToken) {
      const device = await prisma.device.findUnique({
        where: { device_token: deviceToken },
        select: { id: true, user_id: true, name: true, device_type: true },
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
            select: { id: true, user_id: true, name: true, device_type: true },
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
