import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/auth.routes';
import { userRoutes } from './user/user.routes';
import { deviceRoutes } from './device/device.routes';
import { reportRoutes } from './report/report.routes';
import { alarmRoutes } from './alarm/alarm.routes';
import { activationRoutes } from './admin/activation/activation.routes';
import { adminUsersRoutes } from './admin/users/admin-users.routes';
import { ordersRoutes } from './admin/orders/orders.routes';
import { settingsRoutes } from './admin/settings/settings.routes';
import { paymentRoutes } from './payment/payment.routes';
import { logger } from '../utils/logger';

/**
 * 注册所有业务路由
 * @param app Fastify 实例
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  logger.info('Registering routes...');

  await authRoutes(app);

  await userRoutes(app);

  await deviceRoutes(app);

  await reportRoutes(app);

  await alarmRoutes(app);

  await activationRoutes(app);

  await adminUsersRoutes(app);

  await ordersRoutes(app);

  await paymentRoutes(app);

  await settingsRoutes(app);

  logger.info('All routes registered successfully');
}
