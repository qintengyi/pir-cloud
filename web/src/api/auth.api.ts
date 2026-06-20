import apiClient from './client';
import type { ApiResponse, AuthResult, UserPublicInfo } from '../types';

/** 发送验证码 */
export async function sendCode(email: string, type: 'register' | 'reset_password', turnstileToken?: string) {
  const res = await apiClient.post<ApiResponse<null>>('/auth/send-code', {
    email,
    type,
    turnstileToken,
  });
  return res.data;
}

/** 用户注册 */
export async function register(email: string, code: string, password: string, nickname?: string) {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', {
    email,
    code,
    password,
    nickname,
  });
  return res.data.data;
}

/** 用户登录 */
export async function login(email: string, password: string, turnstileToken?: string) {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', {
    email,
    password,
    turnstileToken,
  });
  return res.data.data;
}

/** 忘记密码（发送重置验证码） */
export async function forgotPassword(email: string, turnstileToken?: string) {
  const res = await apiClient.post<ApiResponse<null>>('/auth/forgot-password', {
    email,
    turnstileToken,
  });
  return res.data;
}

/** 重置密码 */
export async function resetPassword(email: string, code: string, newPassword: string) {
  const res = await apiClient.post<ApiResponse<null>>('/auth/reset-password', {
    email,
    code,
    newPassword,
  });
  return res.data;
}

/** 刷新 token */
export async function refreshToken(refreshTokenStr: string) {
  const res = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
    '/auth/refresh',
    { refreshToken: refreshTokenStr },
  );
  return res.data.data;
}

/** 退出登录 */
export async function logout() {
  const refreshTokenStr = localStorage.getItem('pir_cloud_refresh_token') || '';
  const res = await apiClient.post<ApiResponse<null>>('/auth/logout', {
    refreshToken: refreshTokenStr,
  });
  return res.data;
}

/** 获取当前用户信息 */
export async function getMe() {
  const res = await apiClient.get<ApiResponse<{ user: UserPublicInfo }>>('/auth/me');
  return res.data.data;
}
