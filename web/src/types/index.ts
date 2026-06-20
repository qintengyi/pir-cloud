/**
 * 前端类型定义（与后端 DTO 对齐）
 */

/** 统一 API 响应格式 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/** 分页数据 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户角色 */
export type UserRole = 'user' | 'admin';

/** 会员等级 */
export type MembershipLevel = 'free' | 'premium';

/** 通知渠道 */
export type NotifyChannel = 'email' | 'qq_bot';

/** 事件类型 */
export type EventType = 'online' | 'offline' | 'alarm';

/** 设备状态 */
export type DeviceStatus = 'online' | 'offline';

/** 激活码状态 */
export type ActivationCodeStatus = 'unused' | 'bound' | 'disabled';

/** 订单状态 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

/** 验证码类型 */
export type VerificationCodeType = 'register' | 'reset_password';

/** 用户公开信息 */
export interface UserPublicInfo {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
  membershipLevel: MembershipLevel;
  membershipExpireAt: string | null;
  qqNumber: string | null;
  createdAt: string;
}

/** 认证结果 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserPublicInfo;
}

/** Token 刷新结果 */
export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** 会员信息 */
export interface MembershipInfo {
  level: MembershipLevel;
  expireAt: string | null;
  qqBound: boolean;
  isExpired: boolean;
}

/** 设备信息 */
export interface DeviceInfo {
  id: number;
  userId: number;
  activationCodeId: number;
  name: string;
  deviceToken: string;
  status: DeviceStatus;
  lastReportAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
}

/** 设备配置 */
export interface DeviceConfig {
  id: number;
  deviceId: number;
  notifyEnabled: boolean;
  debounceInterval: number;
  notifyChannels: NotifyChannel[];
  onlineRemindEnabled: boolean;
  onlineRemindIntervalMinutes: number;
  lastOnlineRemindAt: string | null;
  createdAt: string;
}

/** 设备详情（含配置） */
export interface DeviceDetail {
  device: DeviceInfo;
  config: DeviceConfig;
}

/** 事件/告警日志 */
export interface AlarmLog {
  id: number;
  deviceId: number;
  userId: number;
  type: EventType;
  detail: {
    message?: string;
    reportData?: Record<string, any>;
    [key: string]: any;
  };
  createdAt: string;
  /** 关联设备名称（列表查询时附带） */
  deviceName?: string;
}

/** 告警统计 */
export interface AlarmStats {
  total: number;
  today: number;
  byDay: { date: string; count: number }[];
}

/** 激活码信息 */
export interface ActivationCodeInfo {
  id: number;
  code: string;
  status: ActivationCodeStatus;
  createdBy: number;
  boundUser: { id: number; email: string; nickname: string } | null;
  boundDevice: { id: number; name: string } | null;
  boundAt: string | null;
  createdAt: string;
}

/** 管理员用户列表项 */
export interface AdminUserListItem {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
  membershipLevel: MembershipLevel;
  membershipExpireAt: string | null;
  qqNumber: string | null;
  deviceCount: number;
  createdAt: string;
}

/** 管理员用户详情 */
export interface AdminUserDetail {
  user: UserPublicInfo;
  deviceCount: number;
  devices: DeviceInfo[];
}

/** 订单信息 */
export interface OrderInfo {
  id: number;
  orderNo: string;
  userId: number;
  userEmail?: string;
  plan: string;
  amount: number;
  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
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

/** 系统配置 */
export interface SystemConfigs {
  smtp: SmtpConfig;
  onebot: OneBotConfig;
}

/** 控制台概览统计 */
export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  todayAlarms: number;
}
