import { FastifyInstance } from 'fastify';
import { reportRateLimit } from '../../middlewares/rateLimit.middleware';
import { reportHandler, heartbeatHandler } from './report.controller';
import { reportSchema, heartbeatSchema } from './report.schema';

/**
 * 注册上报模块路由
 * 设备端接口，无需 JWT 认证，使用 device_token / activation_code 鉴权
 * @param app Fastify 实例
 */
export async function reportRoutes(app: FastifyInstance): Promise<void> {
  
  app.post('/api/report', {
    schema: reportSchema,
    config: { rateLimit: reportRateLimit },
    handler: reportHandler,
  });

  app.post('/api/report/heartbeat', {
    schema: heartbeatSchema,
    config: { rateLimit: reportRateLimit },
    handler: heartbeatHandler,
  });
}
