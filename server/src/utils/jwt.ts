import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types';
import { logger } from './logger';

/**
 * JWT 工具模块
 * 负责签发和验证 access_token / refresh_token
 */

/**
 * 签发 access_token（15分钟有效）
 * @param payload 用户信息载荷
 * @returns JWT access_token 字符串
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  const fullPayload: AccessTokenPayload = {
    ...payload,
    type: 'access',
  };
  return jwt.sign(fullPayload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpires,
  } as jwt.SignOptions);
}

/**
 * 签发 refresh_token（7天有效）
 * @param payload 用户信息载荷
 * @returns JWT refresh_token 字符串
 */
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  const fullPayload: RefreshTokenPayload = {
    ...payload,
    type: 'refresh',
  };
  return jwt.sign(fullPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires,
  } as jwt.SignOptions);
}

/**
 * 验证 access_token
 * @param token JWT access_token 字符串
 * @returns 解码后的载荷，验证失败返回 null
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch (err) {
    logger.debug({ err }, 'Access token verification failed');
    return null;
  }
}

/**
 * 验证 refresh_token
 * @param token JWT refresh_token 字符串
 * @returns 解码后的载荷，验证失败返回 null
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch (err) {
    logger.debug({ err }, 'Refresh token verification failed');
    return null;
  }
}

/**
 * 获取 refresh_token 的过期时间（Date 对象）
 * 从当前时间加上配置的过期时长
 * @returns 过期时间
 */
export function getRefreshTokenExpiry(): Date {
  
  const expiresStr = config.jwt.refreshExpires;
  const match = expiresStr.match(/^(\d+)([smhd])$/);
  if (!match) {
    
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * multipliers[unit]);
}
