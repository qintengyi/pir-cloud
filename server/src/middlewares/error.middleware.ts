import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';
import { error, ErrorCode } from '../utils/response';

/**
 * 全局错误处理中间件
 * 统一处理 Fastify 框架错误和业务错误
 */
export function errorHandler(
  err: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  
  if (err.validation) {
    logger.warn({ err: err.message, url: request.url }, 'Validation error');
    error(reply, ErrorCode.PARAMS_VALIDATION_FAILED.code, `参数校验失败: ${err.message}`, ErrorCode.PARAMS_VALIDATION_FAILED.statusCode);
    return;
  }

  if (err.statusCode === 429) {
    logger.warn({ url: request.url }, 'Rate limit exceeded');
    error(reply, ErrorCode.RATE_LIMIT_EXCEEDED.code, ErrorCode.RATE_LIMIT_EXCEEDED.message, ErrorCode.RATE_LIMIT_EXCEEDED.statusCode);
    return;
  }

  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    logger.warn({ err: err.message, url: request.url, statusCode: err.statusCode }, 'Client error');
    const message = err.statusCode === 404 ? '资源不存在' : (err.message || '请求错误');
    error(reply, ErrorCode.PARAMS_VALIDATION_FAILED.code, message, err.statusCode);
    return;
  }

  logger.error({ err, url: request.url, method: request.method }, 'Internal server error');
  error(reply, ErrorCode.INTERNAL_ERROR.code, ErrorCode.INTERNAL_ERROR.message, ErrorCode.INTERNAL_ERROR.statusCode);
}
