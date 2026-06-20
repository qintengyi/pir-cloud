import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { turnstileMiddleware } from '../../middlewares/turnstile.middleware';
import { authRateLimit } from '../../middlewares/rateLimit.middleware';
import {
  sendCodeHandler,
  registerHandler,
  loginHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './auth.controller';
import {
  sendCodeSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
} from './auth.schema';

/**
 * 注册认证模块路由
 * @param app Fastify 实例
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  
  app.post('/api/auth/send-code', {
    schema: sendCodeSchema,
    preHandler: [turnstileMiddleware],
    config: { rateLimit: authRateLimit },
    handler: sendCodeHandler,
  });

  app.post('/api/auth/register', {
    schema: registerSchema,
    config: { rateLimit: authRateLimit },
    handler: registerHandler,
  });

  app.post('/api/auth/login', {
    schema: loginSchema,
    preHandler: [turnstileMiddleware],
    config: { rateLimit: authRateLimit },
    handler: loginHandler,
  });

  app.post('/api/auth/forgot-password', {
    schema: forgotPasswordSchema,
    preHandler: [turnstileMiddleware],
    config: { rateLimit: authRateLimit },
    handler: forgotPasswordHandler,
  });

  app.post('/api/auth/reset-password', {
    schema: resetPasswordSchema,
    config: { rateLimit: authRateLimit },
    handler: resetPasswordHandler,
  });

  app.post('/api/auth/refresh', {
    schema: refreshSchema,
    handler: refreshHandler,
  });

  app.post('/api/auth/logout', {
    preHandler: [authMiddleware],
    handler: logoutHandler,
  });

  app.get('/api/auth/me', {
    preHandler: [authMiddleware],
    handler: meHandler,
  });
}
