import { useQuery } from '@tanstack/react-query';
import * as deviceApi from '../api/device.api';

/**
 * 设备列表数据 Hook
 */
export function useDevices(page: number = 1, pageSize: number = 20) {
  return useQuery({
    queryKey: ['devices', page, pageSize],
    queryFn: () => deviceApi.listDevices(page, pageSize),
    staleTime: 30 * 1000,
  });
}

/**
 * 设备详情数据 Hook
 */
export function useDeviceDetail(id: number | undefined) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => deviceApi.getDevice(id!),
    enabled: !!id,
  });
}

/**
 * 设备配置数据 Hook
 */
export function useDeviceConfig(id: number | undefined) {
  return useQuery({
    queryKey: ['deviceConfig', id],
    queryFn: () => deviceApi.getDeviceConfig(id!),
    enabled: !!id,
  });
}
