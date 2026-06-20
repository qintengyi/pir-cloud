import apiClient from './client';
import type { ApiResponse, PaginatedData, DeviceInfo, DeviceDetail, DeviceConfig } from '../types';

/** 设备列表 */
export async function listDevices(page: number = 1, pageSize: number = 20) {
  const res = await apiClient.get<ApiResponse<PaginatedData<DeviceInfo>>>('/devices', {
    params: { page, pageSize },
  });
  return res.data.data;
}

/** 设备详情 */
export async function getDevice(id: number) {
  const res = await apiClient.get<ApiResponse<DeviceDetail>>(`/devices/${id}`);
  return res.data.data;
}

/** 重命名设备 */
export async function renameDevice(id: number, name: string) {
  const res = await apiClient.put<ApiResponse<{ device: DeviceInfo }>>(`/devices/${id}`, { name });
  return res.data.data;
}

/** 删除设备 */
export async function deleteDevice(id: number) {
  const res = await apiClient.delete<ApiResponse<null>>(`/devices/${id}`);
  return res.data;
}

/** 绑定设备（激活码） */
export async function bindDevice(activationCode: string) {
  const res = await apiClient.post<ApiResponse<{ device: DeviceInfo }>>('/devices/bind', {
    activationCode,
  });
  return res.data.data;
}

/** 获取设备配置 */
export async function getDeviceConfig(id: number) {
  const res = await apiClient.get<ApiResponse<{ config: DeviceConfig }>>(`/devices/${id}/config`);
  return res.data.data;
}

/** 修改设备配置 */
export async function updateDeviceConfig(
  id: number,
  config: Partial<{
    notifyEnabled: boolean;
    debounceInterval: number;
    notifyChannels: string[];
    onlineRemindEnabled: boolean;
    onlineRemindIntervalMinutes: number;
  }>,
) {
  const res = await apiClient.put<ApiResponse<{ config: DeviceConfig }>>(`/devices/${id}/config`, config);
  return res.data.data;
}
