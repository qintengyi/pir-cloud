import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { adminMiddleware } from '../../../middlewares/admin.middleware';
import {
  generateCodesHandler,
  listCodesHandler,
  disableCodeHandler,
  exportCodesHandler,
} from './activation.controller';
import { generateCodesSchema, listCodesSchema, exportCodesSchema } from './activation.schema';

/**
 * 管理员认证 + 权限校验组合中间件
 */
async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  adminMiddleware(request, reply);
}

/**
 * 注册管理员-激活码管理路由
 * @param app Fastify 实例
 */
export async function activationRoutes(app: FastifyInstance): Promise<void> {
  
  app.post('/api/admin/activation/generate', {
    schema: generateCodesSchema,
    preHandler: [adminAuthMiddleware],
    handler: generateCodesHandler,
  });

  app.get('/api/admin/activation', {
    schema: listCodesSchema,
    preHandler: [adminAuthMiddleware],
    handler: listCodesHandler,
  });

  app.put('/api/admin/activation/:id/disable', {
    preHandler: [adminAuthMiddleware],
    handler: disableCodeHandler,
  });

  app.get('/api/admin/activation/export', {
    schema: exportCodesSchema,
    preHandler: [adminAuthMiddleware],
    handler: exportCodesHandler,
  });
}
