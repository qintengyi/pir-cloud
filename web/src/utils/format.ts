import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化日期时间
 * @param date 日期字符串或 Date 对象
 * @param format 格式模板（默认 YYYY-MM-DD HH:mm:ss）
 * @returns 格式化后的字符串
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!date) return '-';
  return dayjs(date).format(format);
}

/**
 * 格式化日期（仅日期部分）
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD');
}

/**
 * 相对时间（如"3分钟前"）
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).fromNow();
}

/**
 * 格式化金额（分转元，保留2位小数）
 */
export function formatAmount(amount: number): string {
  return `¥${(amount).toFixed(2)}`;
}

/**
 * 截断文本
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 格式化数字（千分位）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * 获取事件类型显示文本
 */
export function getEventLabel(type: string): string {
  const labels: Record<string, string> = {
    online: '上线',
    offline: '离线',
    alarm: '告警',
  };
  return labels[type] || type;
}

/**
 * 获取设备状态显示文本
 */
export function getDeviceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    online: '在线',
    offline: '离线',
  };
  return labels[status] || status;
}

/**
 * 格式化秒数为可读时间
 * @param seconds 秒数
 * @returns 如 "30秒" / "5分钟" / "1小时"
 */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}
