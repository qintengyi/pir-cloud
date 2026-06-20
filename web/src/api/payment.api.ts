import apiClient from './client';
import type { ApiResponse, OrderInfo } from '../types';

/** Create membership purchase order */
export async function createPayment(payType: 'wxpay' | 'alipay') {
  const res = await apiClient.post<ApiResponse<{ orderNo: string; payUrl: string }>>(
    '/payment/create',
    { payType },
  );
  return res.data.data;
}

/** List my orders */
export async function listMyOrders(page = 1, pageSize = 20) {
  const res = await apiClient.get<ApiResponse<{ list: OrderInfo[]; total: number; page: number; pageSize: number }>>(
    '/payment/orders',
    { params: { page, pageSize } },
  );
  return res.data.data;
}
