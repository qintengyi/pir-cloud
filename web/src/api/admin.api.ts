import apiClient from './client';
import type {
  ApiResponse,
  PaginatedData,
  ActivationCodeInfo,
  AdminUserListItem,
  AdminUserDetail,
  OrderInfo,
  SystemConfigs,
} from '../types';

/** 批量生成激活码 */
export async function generateActivationCodes(count: number, prefix?: string) {
  const res = await apiClient.post<ApiResponse<{ codes: string[] }>>('/admin/activation/generate', {
    count,
    prefix,
  });
  return res.data.data;
}

/** 激活码列表 */
export async function listActivationCodes(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const res = await apiClient.get<ApiResponse<PaginatedData<ActivationCodeInfo>>>('/admin/activation', {
    params,
  });
  return res.data.data;
}

/** 禁用激活码 */
export async function disableActivationCode(id: number) {
  const res = await apiClient.put<ApiResponse<null>>(`/admin/activation/${id}/disable`);
  return res.data;
}

/** 导出激活码 CSV（返回下载 URL） */
export function exportActivationCodesUrl(status?: string): string {
  const baseURL = apiClient.defaults.baseURL;
  const params = status ? `?status=${status}` : '';
  return `${baseURL}/admin/activation/export${params}`;
}

/** 用户列表 */
export async function listAdminUsers(params: { search?: string; page?: number; pageSize?: number }) {
  const res = await apiClient.get<ApiResponse<PaginatedData<AdminUserListItem>>>('/admin/users', {
    params,
  });
  return res.data.data;
}

/** 用户详情 */
export async function getAdminUserDetail(id: number) {
  const res = await apiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`);
  return res.data.data;
}

/** 修改会员等级 */
export async function updateAdminUserMembership(
  id: number,
  level: 'free' | 'premium',
  expireAt?: string,
) {
  const res = await apiClient.put<ApiResponse<{ user: AdminUserListItem }>>(
    `/admin/users/${id}/membership`,
    { level, expireAt },
  );
  return res.data.data;
}

/** 订单列表 */
export async function listOrders(params: {
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const res = await apiClient.get<ApiResponse<PaginatedData<OrderInfo>>>('/admin/orders', {
    params,
  });
  return res.data.data;
}

/** 手动创建订单 */
export async function createOrder(userId: number, plan: string, amount: number) {
  const res = await apiClient.post<ApiResponse<{ order: OrderInfo }>>('/admin/orders', {
    userId,
    plan,
    amount,
  });
  return res.data.data;
}

/** 导出订单 CSV URL */
export function exportOrdersUrl(status?: string): string {
  const baseURL = apiClient.defaults.baseURL;
  const params = status ? `?status=${status}` : '';
  return `${baseURL}/admin/orders/export${params}`;
}

/** 获取系统配置 */
export async function getSystemConfigs() {
  const res = await apiClient.get<ApiResponse<SystemConfigs>>('/admin/settings');
  return res.data.data;
}

/** 更新 SMTP 配置 */
export async function updateSmtpConfig(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  secure?: boolean;
}) {
  const res = await apiClient.put<ApiResponse<null>>('/admin/settings/smtp', config);
  return res.data;
}

/** 更新 OneBot 配置 */
export async function updateOneBotConfig(config: { wsUrl: string; token?: string }) {
  const res = await apiClient.put<ApiResponse<null>>('/admin/settings/onebot', config);
  return res.data;
}

/** 测试 SMTP 发送 */
export async function testSmtp(to: string) {
  const res = await apiClient.post<ApiResponse<null>>('/admin/settings/smtp/test', { to });
  return res.data;
}

/** 测试 OneBot 连接 */
export async function testOneBot() {
  const res = await apiClient.post<ApiResponse<null>>('/admin/settings/onebot/test');
  return res.data;
}
