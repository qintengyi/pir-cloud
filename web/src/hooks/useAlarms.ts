import { useQuery } from '@tanstack/react-query';
import * as alarmApi from '../api/alarm.api';

/**
 * 告警列表数据 Hook
 */
export function useAlarms(params: {
  deviceId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['alarms', params],
    queryFn: () => alarmApi.listAlarms(params),
    staleTime: 30 * 1000,
  });
}

/**
 * 告警统计数据 Hook
 */
export function useAlarmStats(days: number = 7) {
  return useQuery({
    queryKey: ['alarmStats', days],
    queryFn: () => alarmApi.getAlarmStats(days),
    staleTime: 60 * 1000,
  });
}
