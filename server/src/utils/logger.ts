import pino from 'pino';
import { config } from '../config/index';

/**
 * Pino 日志实例
 * 开发环境使用 pino-pretty 美化输出，生产环境使用 JSON 格式
 */
export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  base: {
    service: 'pir-cloud-server',
  },
});

/**
 * 创建带上下文的子日志器
 * @param module 模块名称
 * @returns 子日志器实例
 */
export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}
