/**
 * 全局类型定义
 */

/** 统一 API 响应格式 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/** 分页数据格式 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 认证后的用户信息（挂在 request.user 上） */
export interface AuthUser {
  id: number;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  membershipLevel: 'free' | 'premium';
  membershipExpireAt: Date | null;
  qqNumber: string | null;
}

/** JWT Access Token 载荷 */
export interface AccessTokenPayload {
  userId: number;
  email: string;
  role: 'user' | 'admin';
  type: 'access';
}

/** JWT Refresh Token 载荷 */
export interface RefreshTokenPayload {
  userId: number;
  token: string;
  type: 'refresh';
}

/** 认证结果（登录/注册返回） */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserPublicInfo;
}

/** 用户公开信息（不包含密码） */
export interface UserPublicInfo {
  id: number;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  membershipLevel: 'free' | 'premium';
  membershipExpireAt: string | null;
  qqNumber: string | null;
  createdAt: string;
}

/** 设备上报数据 */
export interface ReportData {
  status: 'presence' | 'absence';
  timestamp?: number;
  extra?: Record<string, any>;
}

/** 通知渠道类型 */
export type NotifyChannel = 'email' | 'qq_bot';

/** 验证码类型 */
export type VerificationCodeType = 'register' | 'reset_password';

/** 设备配置信息 */
export interface DeviceConfigInfo {
  notifyEnabled: boolean;
  debounceInterval: number;
  notifyChannels: NotifyChannel[];
  onlineRemindEnabled: boolean;
  onlineRemindIntervalMinutes: number;
  lastOnlineRemindAt: string | null;
}

/** SMTP 配置 */
export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  secure: boolean;
}

/** OneBot 配置 */
export interface OneBotConfig {
  wsUrl: string;
  token: string;
}

/** 告警统计数据 */
export interface AlarmStats {
  total: number;
  today: number;
  byDay: { date: string; count: number }[];
}
