import apiClient from './client';
import type { ApiResponse, PaginatedData, AlarmLog, AlarmStats } from '../types';

/** 告警日志列表 */
export async function listAlarms(params: {
  deviceId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const res = await apiClient.get<ApiResponse<PaginatedData<AlarmLog>>>('/alarms', { params });
  return res.data.data;
}

/** 告警统计 */
export async function getAlarmStats(days: number = 7) {
  const res = await apiClient.get<ApiResponse<{ stats: AlarmStats }>>('/alarms/stats', {
    params: { days },
  });
  return res.data.data;
}
