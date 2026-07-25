import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { oidcLoginHandler, oidcCallbackHandler, oidcBindInitHandler } from './oidc.controller';

/**
 * 注册 OIDC 认证路由
 * @param app Fastify 实例
 */
export async function oidcRoutes(app: FastifyInstance): Promise<void> {
  // 发起 OIDC 登录（重定向到授权服务器）
  app.get('/api/auth/oidc/login', {
    handler: oidcLoginHandler,
  });

  // OIDC 回调（授权服务器重定向回来）
  app.get('/api/auth/oidc/callback', {
    handler: oidcCallbackHandler,
  });

  // 发起 OIDC 绑定（需登录态，重定向到授权服务器）
  app.get('/api/auth/oidc/bind', {
    preHandler: [authMiddleware],
    handler: oidcBindInitHandler,
  });
}
