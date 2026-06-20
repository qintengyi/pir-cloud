import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { adminMiddleware } from '../../../middlewares/admin.middleware';
import {
  listUsersHandler,
  getUserDetailHandler,
  updateMembershipHandler,
} from './admin-users.controller';
import { listUsersSchema, updateMembershipSchema } from './admin-users.schema';

/**
 * 管理员认证 + 权限校验组合中间件
 */
async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  adminMiddleware(request, reply);
}

/**
 * 注册管理员-用户管理路由
 * @param app Fastify 实例
 */
export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  
  app.get('/api/admin/users', {
    schema: listUsersSchema,
    preHandler: [adminAuthMiddleware],
    handler: listUsersHandler,
  });

  app.get('/api/admin/users/:id', {
    preHandler: [adminAuthMiddleware],
    handler: getUserDetailHandler,
  });

  app.put('/api/admin/users/:id/membership', {
    schema: updateMembershipSchema,
    preHandler: [adminAuthMiddleware],
    handler: updateMembershipHandler,
  });
}
