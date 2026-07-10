import apiClient from './client';
import type { ApiResponse, QqVerifyRequestResult, QqVerifyStatus } from '../types';

/** 获取 QQ 验证码 */
export async function requestQqVerify(qqNumber: string) {
  const res = await apiClient.post<ApiResponse<QqVerifyRequestResult>>('/user/qq-verify/request', { qqNumber });
  return res.data.data;
}

/** 查询 QQ 验证状态 */
export async function getQqVerifyStatus() {
  const res = await apiClient.get<ApiResponse<QqVerifyStatus>>('/user/qq-verify/status');
  return res.data.data;
}
