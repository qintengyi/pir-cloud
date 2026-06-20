import { FastifyReply, FastifyRequest } from 'fastify';
import { paymentService } from './payment.service';
import { success, paginated } from '../../utils/response';

/**
 * Payment controller
 */

/** Create membership purchase order */
export async function createPaymentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { payType } = request.body as { payType: 'wxpay' | 'alipay' };

    if (payType !== 'wxpay' && payType !== 'alipay') {
      reply.status(400).send({ code: 4001, message: 'payType invalid', data: null });
      return;
    }

    const clientOrigin = `${request.protocol}://${request.hostname}`;
    const result = await paymentService.createMembershipOrder(userId, payType, clientOrigin);
    success(reply, result, 'order created');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || 'server error',
      data: null,
    });
  }
}

/** Epay async notify (no auth needed) */
export async function notifyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {

    const params = (request.body as Record<string, string>) ||
      (request.query as Record<string, string>) ||
      {};

    const result = await paymentService.handleNotify(params);

    reply.type('text/plain').send(result);
  } catch (err: any) {
    reply.type('text/plain').send('fail');
  }
}

/** List current user orders */
export async function myOrdersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const query = request.query as { page?: string; pageSize?: string };
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const result = await paymentService.listMyOrders(userId, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || 'server error',
      data: null,
    });
  }
}
