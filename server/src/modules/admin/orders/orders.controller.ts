import { FastifyReply, FastifyRequest } from 'fastify';
import { adminOrderService } from './orders.service';
import { success, paginated } from '../../../utils/response';
import { generateCsvFileName } from '../../../utils/csv';

/**
 * 管理员 - 订单管理控制器
 */

/** 订单列表 */
export async function listOrdersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as {
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      pageSize?: string;
    };

    const filters: any = {};
    if (query.status) filters.status = query.status;
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);

    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const result = await adminOrderService.listOrders(filters, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 手动创建订单 */
export async function createOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { userId, plan, amount } = request.body as {
      userId: number;
      plan: string;
      amount: number;
    };
    const order = await adminOrderService.createOrder(userId, plan, amount);
    success(reply, { order }, '创建成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 导出 CSV */
export async function exportOrdersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as { status?: string };
    const filters: any = {};
    if (query.status) filters.status = query.status;

    const csv = await adminOrderService.exportOrders(filters);
    const fileName = generateCsvFileName('orders');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send('\ufeff' + csv);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
