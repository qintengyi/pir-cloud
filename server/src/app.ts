import { buildApp } from './config/fastify';
import { config } from './config/index';
import { logger } from './utils/logger';
import { registerRoutes } from './modules';
import { registerJobs } from './jobs';
import { OneBotService } from './modules/notification/onebot.service';

/**
 * Fastify 应用入口
 * 启动服务、注册路由、注册定时任务
 */
async function main(): Promise<void> {
  try {
    const app = await buildApp();

    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    await registerRoutes(app);

    registerJobs();

    OneBotService.connect();

    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`🚀 pir-cloud Server is running on http://0.0.0.0:${config.port}`);
    logger.info(`📁 Environment: ${config.nodeEnv}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});

main();
