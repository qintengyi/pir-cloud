import apiClient from './client';
import type { ApiResponse, UserPublicInfo, MembershipInfo } from '../types';

/** 获取个人信息 */
export async function getProfile() {
  const res = await apiClient.get<ApiResponse<{ user: UserPublicInfo }>>('/user/profile');
  return res.data.data;
}

/** 修改昵称 */
export async function updateProfile(nickname: string) {
  const res = await apiClient.put<ApiResponse<{ user: UserPublicInfo }>>('/user/profile', { nickname });
  return res.data.data;
}

/** 修改密码 */
export async function changePassword(oldPassword: string, newPassword: string) {
  const res = await apiClient.put<ApiResponse<null>>('/user/password', { oldPassword, newPassword });
  return res.data;
}

/** 获取会员信息 */
export async function getMembership() {
  const res = await apiClient.get<ApiResponse<{ membership: MembershipInfo }>>('/user/membership');
  return res.data.data;
}

/** 绑定 QQ 号 */
export async function updateQQ(qqNumber: string) {
  const res = await apiClient.put<ApiResponse<{ user: UserPublicInfo }>>('/user/qq', { qqNumber });
  return res.data.data;
}
