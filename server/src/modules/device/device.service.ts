import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { generateDeviceToken } from '../../utils/crypto';
import type { NotifyChannel } from '../../types';

/**
 * 设备服务
 * 处理设备列表、详情、重命名、删除、绑定、配置等
 */

export class DeviceService {
  /**
   * 获取用户设备列表（分页）
   * @param userId 用户 ID
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页设备列表
   */
  async listDevices(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where: { user_id: userId },
        include: {
          activation_code: {
            select: { code: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.device.count({ where: { user_id: userId } }),
    ]);

    const list = devices.map((d) => ({
      id: d.id,
      name: d.name,
      deviceToken: d.device_token,
      status: d.status,
      activationCode: d.activation_code.code,
      lastReportAt: d.last_report_at?.toISOString() || null,
      lastHeartbeatAt: d.last_heartbeat_at?.toISOString() || null,
      createdAt: d.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取设备详情（含配置）
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   * @returns 设备详情和配置
   */
  async getDevice(userId: number, deviceId: number) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId },
      include: {
        activation_code: { select: { code: true } },
        config: true,
      },
    });

    if (!device) {
      const error = new Error('设备不存在');
      (error as any).code = 2004;
      (error as any).statusCode = 404;
      throw error;
    }

    return {
      device: {
        id: device.id,
        name: device.name,
        deviceToken: device.device_token,
        status: device.status,
        activationCode: device.activation_code.code,
        lastReportAt: device.last_report_at?.toISOString() || null,
        lastHeartbeatAt: device.last_heartbeat_at?.toISOString() || null,
        createdAt: device.created_at.toISOString(),
      },
      config: device.config
        ? {
            notifyEnabled: device.config.notify_enabled,
            debounceInterval: device.config.debounce_interval,
            notifyChannels: device.config.notify_channels as NotifyChannel[],
            onlineRemindEnabled: device.config.online_remind_enabled,
            onlineRemindIntervalMinutes: device.config.online_remind_interval_minutes,
            lastOnlineRemindAt: device.config.last_online_remind_at?.toISOString() || null,
          }
        : null,
    };
  }

  /**
   * 重命名设备
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   * @param name 新名称
   * @returns 更新后的设备信息
   */
  async renameDevice(userId: number, deviceId: number, name: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId },
    });

    if (!device) {
      const error = new Error('设备不存在');
      (error as any).code = 2004;
      (error as any).statusCode = 404;
      throw error;
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { name },
    });

    logger.info({ userId, deviceId, name }, 'Device renamed');

    return {
      id: updated.id,
      name: updated.name,
      deviceToken: updated.device_token,
      status: updated.status,
      lastReportAt: updated.last_report_at?.toISOString() || null,
      lastHeartbeatAt: updated.last_heartbeat_at?.toISOString() || null,
      createdAt: updated.created_at.toISOString(),
    };
  }

  /**
   * 删除设备
   * 删除设备后激活码状态保持 bound（不可重用）
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   */
  async deleteDevice(userId: number, deviceId: number): Promise<void> {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId },
    });

    if (!device) {
      const error = new Error('设备不存在');
      (error as any).code = 2004;
      (error as any).statusCode = 404;
      throw error;
    }

    await prisma.device.delete({
      where: { id: deviceId },
    });

    logger.info({ userId, deviceId }, 'Device deleted');
  }

  /**
   * 绑定设备（通过激活码）
   * 1. 校验激活码 status=unused
   * 2. 生成 device_token
   * 3. 创建 device + device_config
   * 4. 更新激活码 status=bound
   * 5. 创建 online 事件
   * @param userId 用户 ID
   * @param activationCodeStr 激活码字符串
   * @returns 绑定的设备信息
   */
  async bindDevice(userId: number, activationCodeStr: string) {

    const activationCode = await prisma.activationCode.findUnique({
      where: { code: activationCodeStr },
    });

    if (!activationCode) {
      const error = new Error('激活码无效');
      (error as any).code = 2001;
      (error as any).statusCode = 400;
      throw error;
    }

    if (activationCode.status === 'disabled') {
      const error = new Error('激活码已禁用');
      (error as any).code = 2003;
      (error as any).statusCode = 403;
      throw error;
    }

    if (activationCode.status === 'bound') {
      const error = new Error('激活码已被绑定');
      (error as any).code = 2002;
      (error as any).statusCode = 409;
      throw error;
    }

    const deviceToken = generateDeviceToken();

    const device = await prisma.$transaction(async (tx) => {

      const newDevice = await tx.device.create({
        data: {
          user_id: userId,
          activation_code_id: activationCode.id,
          name: '未命名设备',
          device_token: deviceToken,
          status: 'offline',
        },
      });

      await tx.deviceConfig.create({
        data: {
          device_id: newDevice.id,
          notify_enabled: true,
          debounce_interval: 30,
          notify_channels: ['email'] as any,
        },
      });

      await tx.activationCode.update({
        where: { id: activationCode.id },
        data: {
          status: 'bound',
          user_id: userId,
          device_id: newDevice.id,
          bound_at: new Date(),
        },
      });

      return newDevice;
    });

    logger.info({ userId, deviceId: device.id, activationCode: activationCodeStr }, 'Device bound successfully');

    return {
      id: device.id,
      name: device.name,
      deviceToken: device.device_token,
      status: device.status,
      createdAt: device.created_at.toISOString(),
    };
  }

  /**
   * 获取设备配置
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   * @returns 设备配置
   */
  async getDeviceConfig(userId: number, deviceId: number) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId },
      include: { config: true },
    });

    if (!device) {
      const error = new Error('设备不存在');
      (error as any).code = 2004;
      (error as any).statusCode = 404;
      throw error;
    }

    if (!device.config) {

      const config = await prisma.deviceConfig.create({
        data: {
          device_id: deviceId,
          notify_enabled: true,
          debounce_interval: 30,
          notify_channels: ['email'] as any,
        },
      });

      return {
        notifyEnabled: config.notify_enabled,
        debounceInterval: config.debounce_interval,
        notifyChannels: config.notify_channels as NotifyChannel[],
        onlineRemindEnabled: config.online_remind_enabled,
        onlineRemindIntervalMinutes: config.online_remind_interval_minutes,
        lastOnlineRemindAt: config.last_online_remind_at?.toISOString() || null,
      };
    }

    return {
      notifyEnabled: device.config.notify_enabled,
      debounceInterval: device.config.debounce_interval,
      notifyChannels: device.config.notify_channels as NotifyChannel[],
      onlineRemindEnabled: device.config.online_remind_enabled,
      onlineRemindIntervalMinutes: device.config.online_remind_interval_minutes,
      lastOnlineRemindAt: device.config.last_online_remind_at?.toISOString() || null,
    };
  }

  /**
   * 更新设备配置
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   * @param config 配置更新字段
   * @returns 更新后的配置
   */
  async updateDeviceConfig(
    userId: number,
    deviceId: number,
    config: {
      notifyEnabled?: boolean;
      debounceInterval?: number;
      notifyChannels?: NotifyChannel[];
      onlineRemindEnabled?: boolean;
      onlineRemindIntervalMinutes?: number;
    },
  ) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId },
      include: { config: true },
    });

    if (!device) {
      const error = new Error('设备不存在');
      (error as any).code = 2004;
      (error as any).statusCode = 404;
      throw error;
    }

    if (
      config.onlineRemindIntervalMinutes !== undefined &&
      (config.onlineRemindIntervalMinutes < 1 || config.onlineRemindIntervalMinutes > 10080)
    ) {
      const error = new Error('在线提醒间隔需在 1-10080 分钟之间');
      (error as any).code = 2006;
      (error as any).statusCode = 400;
      throw error;
    }

    if (!device.config) {
      const newConfig = await prisma.deviceConfig.create({
        data: {
          device_id: deviceId,
          notify_enabled: config.notifyEnabled ?? true,
          debounce_interval: config.debounceInterval ?? 30,
          notify_channels: (config.notifyChannels || ['email']) as any,
          online_remind_enabled: config.onlineRemindEnabled ?? false,
          online_remind_interval_minutes: config.onlineRemindIntervalMinutes ?? 360,

          last_online_remind_at: config.onlineRemindEnabled ? new Date() : null,
        },
      });

      return {
        notifyEnabled: newConfig.notify_enabled,
        debounceInterval: newConfig.debounce_interval,
        notifyChannels: newConfig.notify_channels as NotifyChannel[],
        onlineRemindEnabled: newConfig.online_remind_enabled,
        onlineRemindIntervalMinutes: newConfig.online_remind_interval_minutes,
        lastOnlineRemindAt: newConfig.last_online_remind_at?.toISOString() || null,
      };
    }

    const updateData: any = {};
    if (config.notifyEnabled !== undefined) updateData.notify_enabled = config.notifyEnabled;
    if (config.debounceInterval !== undefined) updateData.debounce_interval = config.debounceInterval;
    if (config.notifyChannels !== undefined) updateData.notify_channels = config.notifyChannels as any;
    if (config.onlineRemindIntervalMinutes !== undefined) updateData.online_remind_interval_minutes = config.onlineRemindIntervalMinutes;

    const shouldResetOnlineRemindTimer =
      config.onlineRemindEnabled === true ||
      (device.config.online_remind_enabled && config.onlineRemindIntervalMinutes !== undefined);

    if (config.onlineRemindEnabled !== undefined) {
      updateData.online_remind_enabled = config.onlineRemindEnabled;
    }

    if (shouldResetOnlineRemindTimer) {
      updateData.last_online_remind_at = new Date();
    }

    const updated = await prisma.deviceConfig.update({
      where: { device_id: deviceId },
      data: updateData,
    });

    logger.info({ userId, deviceId }, 'Device config updated');

    return {
      notifyEnabled: updated.notify_enabled,
      debounceInterval: updated.debounce_interval,
      notifyChannels: updated.notify_channels as NotifyChannel[],
      onlineRemindEnabled: updated.online_remind_enabled,
      onlineRemindIntervalMinutes: updated.online_remind_interval_minutes,
      lastOnlineRemindAt: updated.last_online_remind_at?.toISOString() || null,
    };
  }

  /**
   * 设备直连激活（激活码换 device_token）
   * ESP8266 设备端无 JWT，配网后只有激活码，需通过此方法换取已绑定的 device_token
   *
   * 前置条件：激活码必须已被用户在控制台绑定（status === 'bound'），
   * 即用户已通过 POST /api/devices/bind 完成绑定流程，设备记录已创建。
   *
   * @param activationCodeStr 激活码字符串
   * @returns 设备 token、ID、名称
   */
  async activateDevice(activationCodeStr: string) {

    const activationCode = await prisma.activationCode.findUnique({
      where: { code: activationCodeStr },
      include: {
        device: {
          select: { id: true, name: true, device_token: true },
        },
      },
    });

    if (!activationCode) {
      const error = new Error('激活码无效');
      (error as any).code = 2001;
      (error as any).statusCode = 400;
      throw error;
    }

    if (activationCode.status === 'disabled') {
      const error = new Error('激活码已禁用');
      (error as any).code = 2003;
      (error as any).statusCode = 403;
      throw error;
    }

    if (activationCode.status !== 'bound' || !activationCode.device) {
      const error = new Error('激活码尚未绑定设备，请先在控制台绑定');
      (error as any).code = 2005;
      (error as any).statusCode = 403;
      throw error;
    }

    logger.info(
      { deviceId: activationCode.device.id, activationCode: activationCodeStr },
      'Device activated via activation code',
    );

    return {
      deviceToken: activationCode.device.device_token,
      deviceId: activationCode.device.id,
      deviceName: activationCode.device.name,
    };
  }

  /**
   * 获取用户设备总数和在线数（供控制台统计使用）
   * @param userId 用户 ID
   * @returns 统计数据
   */
  async getDeviceStats(userId: number): Promise<{ total: number; online: number; offline: number }> {
    const [total, online] = await Promise.all([
      prisma.device.count({ where: { user_id: userId } }),
      prisma.device.count({ where: { user_id: userId, status: 'online' } }),
    ]);

    return { total, online, offline: total - online };
  }
}

export const deviceService = new DeviceService();
