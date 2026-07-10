import { FastifyInstance } from 'fastify';
import {
  getLatestHandler,
  downloadLatestHandler,
  downloadByVersionHandler,
} from './firmware.controller';

/**
 * 注册公开固件路由（设备/用户拉取，无需鉴权）
 * 固件 bin 不敏感，下载端点公开，便于 Plan B 本地 helper 无 token 拉取。
 * @param app Fastify 实例
 */
export async function firmwareRoutes(app: FastifyInstance): Promise<void> {

  // 最新固件元数据
  app.get('/api/firmware/latest', {
    handler: getLatestHandler,
  });

  // 下载最新固件
  app.get('/api/firmware/download/latest', {
    handler: downloadLatestHandler,
  });

  // 按版本号下载固件
  app.get('/api/firmware/download/:version', {
    handler: downloadByVersionHandler,
  });
}
