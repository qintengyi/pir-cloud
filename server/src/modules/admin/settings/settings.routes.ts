import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { adminMiddleware } from '../../../middlewares/admin.middleware';
import {
  getConfigsHandler,
  updateSmtpHandler,
  updateOneBotHandler,
  testSmtpHandler,
  testOneBotHandler,
} from './settings.controller';
import { updateSmtpSchema, updateOneBotSchema, testSmtpSchema } from './settings.schema';

/**
 * 管理员认证 + 权限校验组合中间件
 */
async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  adminMiddleware(request, reply);
}

/**
 * 注册管理员-系统配置路由
 * @param app Fastify 实例
 */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  
  app.get('/api/admin/settings', {
    preHandler: [adminAuthMiddleware],
    handler: getConfigsHandler,
  });

  app.put('/api/admin/settings/smtp', {
    schema: updateSmtpSchema,
    preHandler: [adminAuthMiddleware],
    handler: updateSmtpHandler,
  });

  app.put('/api/admin/settings/onebot', {
    schema: updateOneBotSchema,
    preHandler: [adminAuthMiddleware],
    handler: updateOneBotHandler,
  });

  app.post('/api/admin/settings/smtp/test', {
    schema: testSmtpSchema,
    preHandler: [adminAuthMiddleware],
    handler: testSmtpHandler,
  });

  app.post('/api/admin/settings/onebot/test', {
    preHandler: [adminAuthMiddleware],
    handler: testOneBotHandler,
  });
}
