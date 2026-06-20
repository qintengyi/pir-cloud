import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';

/**
 * 防抖去重服务
 * 检查设备在防抖窗口内是否已有告警事件，避免重复告警
 */
class DebounceServiceClass {
  /**
   * 判断是否应该触发告警
   * 查询该设备最近一次 alarm 事件，如果距离现在不足防抖间隔则去重
   * @param deviceId 设备 ID
   * @param debounceInterval 防抖间隔（秒）
   * @returns true=允许触发, false=防抖丢弃
   */
  async shouldTrigger(deviceId: number, debounceInterval: number): Promise<boolean> {
    
    const lastAlarm = await prisma.event.findFirst({
      where: {
        device_id: deviceId,
        type: 'alarm',
      },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    if (!lastAlarm) {
      
      return true;
    }

    const now = Date.now();
    const lastAlarmTime = lastAlarm.created_at.getTime();
    const elapsedSeconds = (now - lastAlarmTime) / 1000;

    if (elapsedSeconds < debounceInterval) {
      logger.debug(
        { deviceId, elapsedSeconds, debounceInterval },
        'Alarm debounced: within debounce window',
      );
      return false;
    }

    return true;
  }
}

export const DebounceService = new DebounceServiceClass();
