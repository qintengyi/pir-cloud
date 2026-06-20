import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import type { AlarmStats } from '../../types';
import type { EventType } from '@prisma/client';

/**
 * 告警服务
 * 处理告警日志查询和统计
 */

export class AlarmService {
  /**
   * 查询告警/事件日志列表（分页）
   * @param userId 用户 ID
   * @param filters 筛选条件
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页事件列表
   */
  async listAlarms(
    userId: number,
    filters: {
      deviceId?: number;
      type?: EventType;
      startDate?: Date;
      endDate?: Date;
    },
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    const where: any = { user_id: userId };

    if (filters.deviceId) {
      where.device_id = filters.deviceId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          device: {
            select: { id: true, name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.event.count({ where }),
    ]);

    const list = events.map((e) => ({
      id: e.id,
      deviceId: e.device_id,
      deviceName: e.device.name,
      type: e.type,
      detail: e.detail,
      createdAt: e.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取告警统计
   * @param userId 用户 ID
   * @param days 统计天数
   * @returns 统计数据
   */
  async getAlarmStats(userId: number, days: number): Promise<AlarmStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const total = await prisma.event.count({
      where: {
        user_id: userId,
        type: 'alarm',
      },
    });

    const today = await prisma.event.count({
      where: {
        user_id: userId,
        type: 'alarm',
        created_at: { gte: todayStart },
      },
    });

    const dailyEvents = await prisma.event.findMany({
      where: {
        user_id: userId,
        type: 'alarm',
        created_at: { gte: daysAgo },
      },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });

    const byDayMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      byDayMap.set(dateStr, 0);
    }

    for (const event of dailyEvents) {
      const dateStr = event.created_at.toISOString().split('T')[0];
      const current = byDayMap.get(dateStr) || 0;
      byDayMap.set(dateStr, current + 1);
    }

    const byDay = Array.from(byDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, today, byDay };
  }

  /**
   * 创建告警事件（供 ReportService 调用）
   * @param deviceId 设备 ID
   * @param userId 用户 ID
   * @param detail 事件详情
   * @returns 创建的事件
   */
  async createAlarmEvent(
    deviceId: number,
    userId: number,
    detail: Record<string, any>,
  ) {
    const event = await prisma.event.create({
      data: {
        device_id: deviceId,
        user_id: userId,
        type: 'alarm',
        detail: detail as any,
      },
    });

    logger.info({ deviceId, userId, eventId: event.id }, 'Alarm event created');
    return event;
  }

  /**
   * 获取用户最近告警（供控制台概览页使用）
   * @param userId 用户 ID
   * @param limit 返回条数
   * @returns 最近告警列表
   */
  async getRecentAlarms(userId: number, limit: number = 10) {
    const events = await prisma.event.findMany({
      where: {
        user_id: userId,
        type: 'alarm',
      },
      include: {
        device: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      deviceId: e.device_id,
      deviceName: e.device.name,
      type: e.type,
      detail: e.detail,
      createdAt: e.created_at.toISOString(),
    }));
  }

  /**
   * 获取用户今日告警数（供控制台概览页使用）
   * @param userId 用户 ID
   * @returns 今日告警数
   */
  async getTodayAlarmCount(userId: number): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return prisma.event.count({
      where: {
        user_id: userId,
        type: 'alarm',
        created_at: { gte: todayStart },
      },
    });
  }
}

export const alarmService = new AlarmService();
