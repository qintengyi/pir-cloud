import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './index';
import { logger } from '../utils/logger';
import { errorHandler } from '../middlewares/error.middleware';

/**
 * 创建并配置 Fastify 实例
 * @param opts 可选的 Fastify 配置覆盖
 * @returns 配置好的 Fastify 实例
 */
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, 
    trustProxy: true,
    bodyLimit: 1024 * 1024, 
    ...opts,
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.isProduction ? undefined : false,
  });

  await app.register(cors, {
    origin: config.isProduction ? false : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: false, 
    max: 100,
    timeWindow: '1 minute',
  });

  app.setErrorHandler(errorHandler);

  return app;
}
