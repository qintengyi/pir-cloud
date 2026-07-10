import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  requestQqVerifyHandler,
  getQqVerifyStatusHandler,
  qqVerifyCallbackHandler,
} from './qq-verify.controller';
import { requestQqVerifySchema, qqVerifyCallbackSchema } from './qq-verify.schema';

/**
 * QQ 验证路由
 */
export async function qqVerifyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/user/qq-verify/request', {
    preHandler: [authMiddleware],
    schema: requestQqVerifySchema,
    handler: requestQqVerifyHandler,
  });

  app.get('/api/user/qq-verify/status', {
    preHandler: [authMiddleware],
    handler: getQqVerifyStatusHandler,
  });

  app.post('/api/qq-verify/callback', {
    schema: qqVerifyCallbackSchema,
    handler: qqVerifyCallbackHandler,
  });
}
