import { FastifyRequest } from 'fastify';
import { config } from '../config/index';
import { ErrorCode } from '../utils/response';

/**
 * 速率限制配置预设
 */

/**
 * 认证接口速率限制（5次/分钟）
 */
export const authRateLimit = {
  max: config.rateLimit.auth,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest): string => {
    
    return request.ip;
  },
  errorResponseBuilder: () => {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
      message: ErrorCode.RATE_LIMIT_EXCEEDED.message,
      data: null,
    };
  },
};

/**
 * 上报接口速率限制（60次/分钟）
 */
export const reportRateLimit = {
  max: config.rateLimit.report,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest): string => {
    
    const deviceToken = request.headers['x-device-token'] as string | undefined;
    return deviceToken || request.ip;
  },
  errorResponseBuilder: () => {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
      message: ErrorCode.RATE_LIMIT_EXCEEDED.message,
      data: null,
    };
  },
};

/**
 * 通用接口速率限制（100次/分钟）
 */
export const generalRateLimit = {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest): string => {
    return request.ip;
  },
  errorResponseBuilder: () => {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
      message: ErrorCode.RATE_LIMIT_EXCEEDED.message,
      data: null,
    };
  },
};

/**
 * 设备激活接口速率限制（10次/分钟）
 * 设备端无 JWT，使用激活码鉴权，需防止激活码暴力枚举
 */
export const deviceActivateRateLimit = {
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest): string => {
    
    const activationCode = request.headers['x-activation-code'] as string | undefined;
    return activationCode || request.ip;
  },
  errorResponseBuilder: () => {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
      message: ErrorCode.RATE_LIMIT_EXCEEDED.message,
      data: null,
    };
  },
};

/**
 * 速率限制使用说明：
 * 在路由注册时通过 config 选项配置，如：
 *   app.post('/path', { config: { rateLimit: authRateLimit }, handler })
 * Fastify rate-limit 插件会自动读取路由 config 中的 rateLimit 配置
 */
