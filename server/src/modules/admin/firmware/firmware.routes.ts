import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { adminMiddleware } from '../../../middlewares/admin.middleware';
import {
  uploadFirmwareHandler,
  listFirmwaresHandler,
  setLatestHandler,
  deleteFirmwareHandler,
  downloadFirmwareHandler,
} from './firmware.controller';
import { listFirmwaresSchema } from './firmware.schema';

/**
 * 管理员认证 + 权限校验组合中间件
 */
async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  adminMiddleware(request, reply);
}

/**
 * 注册管理员-固件版本管理路由
 * @param app Fastify 实例
 */
export async function adminFirmwareRoutes(app: FastifyInstance): Promise<void> {

  // 上传固件（multipart/form-data）
  app.post('/api/admin/firmware/upload', {
    preHandler: [adminAuthMiddleware],
    handler: uploadFirmwareHandler,
  });

  // 固件版本列表
  app.get('/api/admin/firmware', {
    schema: listFirmwaresSchema,
    preHandler: [adminAuthMiddleware],
    handler: listFirmwaresHandler,
  });

  // 设为最新
  app.put('/api/admin/firmware/:id/latest', {
    preHandler: [adminAuthMiddleware],
    handler: setLatestHandler,
  });

  // 删除固件版本
  app.delete('/api/admin/firmware/:id', {
    preHandler: [adminAuthMiddleware],
    handler: deleteFirmwareHandler,
  });

  // 下载固件（管理员按 id 下载）
  app.get('/api/admin/firmware/:id/download', {
    preHandler: [adminAuthMiddleware],
    handler: downloadFirmwareHandler,
  });
}
