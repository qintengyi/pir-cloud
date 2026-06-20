import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { adminMiddleware } from '../../../middlewares/admin.middleware';
import {
  listOrdersHandler,
  createOrderHandler,
  exportOrdersHandler,
} from './orders.controller';
import { listOrdersSchema, createOrderSchema, exportOrdersSchema } from './orders.schema';

/**
 * 管理员认证 + 权限校验组合中间件
 */
async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  adminMiddleware(request, reply);
}

/**
 * 注册管理员-订单管理路由
 * @param app Fastify 实例
 */
export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  
  app.get('/api/admin/orders', {
    schema: listOrdersSchema,
    preHandler: [adminAuthMiddleware],
    handler: listOrdersHandler,
  });

  app.post('/api/admin/orders', {
    schema: createOrderSchema,
    preHandler: [adminAuthMiddleware],
    handler: createOrderHandler,
  });

  app.get('/api/admin/orders/export', {
    schema: exportOrdersSchema,
    preHandler: [adminAuthMiddleware],
    handler: exportOrdersHandler,
  });
}
