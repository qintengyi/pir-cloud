import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listAlarmsHandler, alarmStatsHandler } from './alarm.controller';
import { listAlarmsSchema, alarmStatsSchema } from './alarm.schema';

/**
 * 注册告警模块路由
 * @param app Fastify 实例
 */
export async function alarmRoutes(app: FastifyInstance): Promise<void> {
  
  app.get('/api/alarms', {
    schema: listAlarmsSchema,
    preHandler: [authMiddleware],
    handler: listAlarmsHandler,
  });

  app.get('/api/alarms/stats', {
    schema: alarmStatsSchema,
    preHandler: [authMiddleware],
    handler: alarmStatsHandler,
  });
}
