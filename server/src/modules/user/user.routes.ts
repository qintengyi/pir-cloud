import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  getMembershipHandler,
  updateQQHandler,
} from './user.controller';
import {
  updateProfileSchema,
  changePasswordSchema,
  updateQQSchema,
} from './user.schema';

/**
 * 注册用户模块路由
 * @param app Fastify 实例
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  
  app.get('/api/user/profile', {
    preHandler: [authMiddleware],
    handler: getProfileHandler,
  });

  app.put('/api/user/profile', {
    schema: updateProfileSchema,
    preHandler: [authMiddleware],
    handler: updateProfileHandler,
  });

  app.put('/api/user/password', {
    schema: changePasswordSchema,
    preHandler: [authMiddleware],
    handler: changePasswordHandler,
  });

  app.get('/api/user/membership', {
    preHandler: [authMiddleware],
    handler: getMembershipHandler,
  });

  app.put('/api/user/qq', {
    schema: updateQQSchema,
    preHandler: [authMiddleware],
    handler: updateQQHandler,
  });
}
