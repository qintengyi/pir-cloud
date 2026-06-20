import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import { config } from '../config/index';
import { logger } from '../utils/logger';
import { errorWithCode, ErrorCode } from '../utils/response';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Cloudflare Turnstile 人机验证中间件
 * 验证请求体中的 turnstileToken 字段
 *
 * 使用方式: 在需要 Turnstile 验证的路由上添加此中间件作为 preHandler
 *
 * 跳过验证条件（按优先级）：
 *   1. 使用 Cloudflare 测试密钥（无论 dev/prod）—— 表示尚未接入真实 Turnstile
 *   2. 开发环境（NODE_ENV !== 'production'）
 *
 * 支持：登录/注册使用独立的 widget + secret key，路由路径自动选择对应 secret
 */
export async function turnstileMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const turnstileConfig = config.turnstile;
  
  const allSecrets = [turnstileConfig.secretKey, turnstileConfig.secretKeyRegister].filter(Boolean) as string[];
  const isUsingTestKey = allSecrets.length === 0 || allSecrets.every((s) => s.startsWith('1x0000000000000000000000000000000AA'));

  if (isUsingTestKey) {
    logger.debug('Turnstile verification skipped: using Cloudflare test key (placeholder mode)');
    return;
  }

  if (!config.isProduction) {
    logger.debug('Turnstile verification skipped in development mode');
    return;
  }

  const body = request.body as { turnstileToken?: string } | undefined;
  const turnstileToken = body?.turnstileToken;

  if (!turnstileToken) {
    errorWithCode(reply, ErrorCode.PARAMS_VALIDATION_FAILED, '人机验证token缺失');
    return;
  }

  const url = request.url.toLowerCase();
  const isRegisterPath = url.includes('register') || url.includes('send-code') || url.includes('forgot-password');
  const secretToUse = (isRegisterPath && turnstileConfig.secretKeyRegister) || turnstileConfig.secretKey;

  try {
    const response = await axios.post<TurnstileVerifyResponse>(
      turnstileConfig.verifyUrl,
      new URLSearchParams({
        secret: secretToUse,
        response: turnstileToken,
        remoteip: request.ip,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      },
    );

    if (!response.data.success) {
      logger.warn({ errorCodes: response.data['error-codes'], path: url }, 'Turnstile verification failed');
      errorWithCode(reply, ErrorCode.PARAMS_VALIDATION_FAILED, '人机验证失败，请重试');
      return;
    }
  } catch (err) {
    logger.error({ err }, 'Turnstile verification request failed');
    
    logger.warn('Turnstile service unavailable, allowing request through');
  }
}
