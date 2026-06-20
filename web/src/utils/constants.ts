/**
 * 全局常量定义
 */

/** 路由路径 */
export const ROUTE_PATHS = {

  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  DASHBOARD: '/',
  DEVICES: '/devices',
  DEVICE_DETAIL: '/devices/:id',
  ALARMS: '/alarms',
  NOTIFICATIONS: '/notifications',
  PROFILE: '/profile',

  ADMIN_DASHBOARD: '/admin',
  ADMIN_ACTIVATION: '/admin/activation-codes',
  ADMIN_USERS: '/admin/users',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_SETTINGS: '/admin/settings',
} as const;

/** 事件类型映射 */
export const EVENT_TYPE_MAP: Record<string, { label: string; color: 'success' | 'error' | 'default' | 'warning' }> = {
  online: { label: '上线', color: 'success' },
  offline: { label: '离线', color: 'default' },
  alarm: { label: '告警', color: 'error' },
};

/** 设备状态映射 */
export const DEVICE_STATUS_MAP: Record<string, { label: string; color: 'success' | 'default' }> = {
  online: { label: '在线', color: 'success' },
  offline: { label: '离线', color: 'default' },
};

/** 激活码状态映射 */
export const ACTIVATION_CODE_STATUS_MAP: Record<string, { label: string; color: 'success' | 'primary' | 'default' }> = {
  unused: { label: '未使用', color: 'primary' },
  bound: { label: '已绑定', color: 'success' },
  disabled: { label: '已禁用', color: 'default' },
};

/** 订单状态映射 */
export const ORDER_STATUS_MAP: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  pending: { label: '待支付', color: 'warning' },
  paid: { label: '已支付', color: 'success' },
  cancelled: { label: '已取消', color: 'default' },
  refunded: { label: '已退款', color: 'error' },
};

/** 会员等级映射 */
export const MEMBERSHIP_MAP: Record<string, { label: string; color: 'default' | 'primary' }> = {
  free: { label: '免费用户', color: 'default' },
  premium: { label: '付费会员', color: 'primary' },
};

/** 通知渠道映射 */
export const NOTIFY_CHANNEL_MAP: Record<string, { label: string; icon: string }> = {
  email: { label: '邮箱通知', icon: 'mail' },
  qq_bot: { label: 'QQ通知', icon: 'chat' },
};

/** 防抖间隔范围（秒） */
export const DEBOUNCE_RANGE = {
  min: 5,
  max: 3600,
  default: 30,
  step: 5,
};

/** 持续在线提醒间隔范围（分钟） */
export const ONLINE_REMIND_RANGE = {
  min: 1,
  max: 10080,
  default: 360,
  step: 1,
};

/** 分页选项 */
export const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** localStorage 键名 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pir_cloud_access_token',
  REFRESH_TOKEN: 'pir_cloud_refresh_token',
} as const;

/** 主题色配置 */
export const THEME_COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',
  secondary: '#0891b2',
  background: '#f8fafc',
  surface: '#ffffff',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
};

/** 轮询间隔 */
export const POLL_INTERVALS = {
  DASHBOARD: 30 * 1000,
  DEVICE_LIST: 30 * 1000,
};

/** Cloudflare Turnstile 站点密钥（前端公钥，用于渲染 widget） */
export const TURNSTILE_SITE_KEYS = {

  login: '0x4AAAAAADinuFAATCEbWkGv',

  register: '0x4AAAAAADinDEQKZ2Vww28Y',
} as const;
