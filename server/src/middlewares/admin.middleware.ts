import { FastifyReply, FastifyRequest } from 'fastify';
import { errorWithCode, ErrorCode } from '../utils/response';

/**
 * 管理员权限中间件
 * 必须在 authMiddleware 之后使用
 * 检查当前用户是否拥有 admin 角色
 */
export function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (!request.user) {
    errorWithCode(reply, ErrorCode.NOT_AUTHENTICATED);
    return;
  }

  if (request.user.role !== 'admin') {
    errorWithCode(reply, ErrorCode.NO_PERMISSION);
    return;
  }
}
