import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { deviceActivateRateLimit } from '../../middlewares/rateLimit.middleware';
import {
  listDevicesHandler,
  getDeviceHandler,
  renameDeviceHandler,
  deleteDeviceHandler,
  bindDeviceHandler,
  activateDeviceHandler,
  getDeviceConfigHandler,
  updateDeviceConfigHandler,
} from './device.controller';
import {
  renameDeviceSchema,
  bindDeviceSchema,
  activateDeviceSchema,
  updateDeviceConfigSchema,
  listDevicesSchema,
} from './device.schema';

/**
 * 注册设备模块路由
 * @param app Fastify 实例
 */
export async function deviceRoutes(app: FastifyInstance): Promise<void> {

  app.post('/api/device/activate', {
    schema: activateDeviceSchema,
    config: { rateLimit: deviceActivateRateLimit },
    handler: activateDeviceHandler,
  });

  app.get('/api/devices', {
    schema: listDevicesSchema,
    preHandler: [authMiddleware],
    handler: listDevicesHandler,
  });

  app.post('/api/devices/bind', {
    schema: bindDeviceSchema,
    preHandler: [authMiddleware],
    handler: bindDeviceHandler,
  });

  app.get('/api/devices/:id', {
    preHandler: [authMiddleware],
    handler: getDeviceHandler,
  });

  app.put('/api/devices/:id', {
    schema: renameDeviceSchema,
    preHandler: [authMiddleware],
    handler: renameDeviceHandler,
  });

  app.delete('/api/devices/:id', {
    preHandler: [authMiddleware],
    handler: deleteDeviceHandler,
  });

  app.get('/api/devices/:id/config', {
    preHandler: [authMiddleware],
    handler: getDeviceConfigHandler,
  });

  app.put('/api/devices/:id/config', {
    schema: updateDeviceConfigSchema,
    preHandler: [authMiddleware],
    handler: updateDeviceConfigHandler,
  });
}
