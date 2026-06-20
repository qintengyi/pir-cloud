import { prisma } from '../../../config/prisma';
import { logger } from '../../../utils/logger';
import { generateOrderNo } from '../../../utils/crypto';
import { toCsv } from '../../../utils/csv';
import type { OrderStatus } from '@prisma/client';

/**
 * 管理员 - 订单管理服务
 */
export class AdminOrderService {
  /**
   * 查询订单列表（分页）
   * @param filters 筛选条件
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页订单列表
   */
  async listOrders(
    filters: {
      status?: OrderStatus;
      startDate?: Date;
      endDate?: Date;
    },
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, nickname: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const list = orders.map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      userId: o.user_id,
      userEmail: o.user.email,
      userNickname: o.user.nickname,
      plan: o.plan,
      amount: parseFloat(o.amount.toString()),
      status: o.status,
      paidAt: o.paid_at?.toISOString() || null,
      createdAt: o.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 手动创建订单
   * @param userId 用户 ID
   * @param plan 套餐名称
   * @param amount 金额
   * @returns 创建的订单
   */
  async createOrder(userId: number, plan: string, amount: number) {
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 404;
      throw error;
    }

    const order = await prisma.order.create({
      data: {
        order_no: generateOrderNo(),
        user_id: userId,
        plan,
        amount: amount,
        status: 'paid',
        paid_at: new Date(),
      },
    });

    logger.info({ orderId: order.id, userId, plan, amount }, 'Order created manually');

    return {
      id: order.id,
      orderNo: order.order_no,
      userId: order.user_id,
      plan: order.plan,
      amount: parseFloat(order.amount.toString()),
      status: order.status,
      paidAt: order.paid_at?.toISOString() || null,
      createdAt: order.created_at.toISOString(),
    };
  }

  /**
   * 导出订单为 CSV
   * @param filters 筛选条件
   * @returns CSV 字符串
   */
  async exportOrders(filters: { status?: OrderStatus }): Promise<string> {
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      { key: 'orderNo', label: '订单号' },
      { key: 'userEmail', label: '用户邮箱' },
      { key: 'plan', label: '套餐' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态' },
      { key: 'paidAt', label: '支付时间' },
      { key: 'createdAt', label: '创建时间' },
    ];

    const rows = orders.map((o) => ({
      orderNo: o.order_no,
      userEmail: o.user.email,
      plan: o.plan,
      amount: parseFloat(o.amount.toString()),
      status: o.status,
      paidAt: o.paid_at?.toLocaleString('zh-CN') || '',
      createdAt: o.created_at.toLocaleString('zh-CN'),
    }));

    return toCsv(headers, rows);
  }
}

export const adminOrderService = new AdminOrderService();
