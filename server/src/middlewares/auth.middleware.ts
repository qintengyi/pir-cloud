import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { errorWithCode, ErrorCode } from '../utils/response';
import type { AuthUser } from '../types';

/**
 * JWT 认证中间件
 * 从 Authorization Header 提取 access_token 并验证
 * 验证通过后将用户信息挂载到 request.user
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    errorWithCode(reply, ErrorCode.NOT_AUTHENTICATED);
    return;
  }

  const token = authHeader.substring(7); 
  const payload = verifyAccessToken(token);

  if (!payload) {
    
    errorWithCode(reply, ErrorCode.TOKEN_EXPIRED);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      role: true,
      membership_level: true,
      membership_expire_at: true,
      qq_number: true,
    },
  });

  if (!user) {
    errorWithCode(reply, ErrorCode.TOKEN_INVALID);
    return;
  }

  const isPremiumExpired =
    user.membership_level === 'premium' &&
    user.membership_expire_at &&
    user.membership_expire_at < new Date();

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    membershipLevel: isPremiumExpired ? 'free' : user.membership_level,
    membershipExpireAt: user.membership_expire_at,
    qqNumber: user.qq_number,
  };

  request.user = authUser;
}
