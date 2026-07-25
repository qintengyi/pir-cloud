import apiClient from './client';
import type { ApiResponse, PaginatedData, FirmwareVersionInfo, LatestFirmwareInfo, DeviceType } from '../types';

/** 固件版本列表 */
export async function listFirmwares(params: { page?: number; pageSize?: number; deviceType?: DeviceType }) {
  const res = await apiClient.get<ApiResponse<PaginatedData<FirmwareVersionInfo>>>('/admin/firmware', {
    params,
  });
  return res.data.data;
}

/** 上传固件版本（multipart/form-data） */
export async function uploadFirmware(data: {
  version: string;
  changelog?: string;
  isLatest: boolean;
  file: File;
  deviceType?: DeviceType;
}) {
  const form = new FormData();
  form.append('version', data.version);
  if (data.changelog) form.append('changelog', data.changelog);
  form.append('isLatest', String(data.isLatest));
  form.append('deviceType', data.deviceType || 'infrared');
  form.append('file', data.file);
  const res = await apiClient.post<ApiResponse<FirmwareVersionInfo>>('/admin/firmware/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

/** 设为最新 */
export async function setLatestFirmware(id: number) {
  const res = await apiClient.put<ApiResponse<null>>(`/admin/firmware/${id}/latest`);
  return res.data;
}

/** 删除固件版本 */
export async function deleteFirmware(id: number) {
  const res = await apiClient.delete<ApiResponse<null>>(`/admin/firmware/${id}`);
  return res.data;
}

/** 管理员下载固件 URL（按 id） */
export function downloadFirmwareUrl(id: number): string {
  const baseURL = apiClient.defaults.baseURL;
  return `${baseURL}/admin/firmware/${id}/download`;
}

/** 获取最新固件元数据（公开接口） */
export async function getLatestFirmware(deviceType?: DeviceType) {
  const params: Record<string, any> = {};
  if (deviceType) params.deviceType = deviceType;
  const res = await apiClient.get<ApiResponse<LatestFirmwareInfo>>('/firmware/latest', { params });
  return res.data.data;
}
