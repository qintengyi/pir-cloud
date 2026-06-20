import { FastifyReply, FastifyRequest } from 'fastify';
import { adminUserService } from './admin-users.service';
import { success, paginated } from '../../../utils/response';

/**
 * 管理员 - 用户管理控制器
 */

/** 用户列表 */
export async function listUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as {
      search?: string;
      page?: string;
      pageSize?: string;
    };

    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const result = await adminUserService.listUsers(query.search, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 用户详情 */
export async function getUserDetailHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const result = await adminUserService.getUserDetail(parseInt(id, 10));
    success(reply, result, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 修改会员等级 */
export async function updateMembershipHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const { level, expireAt } = request.body as {
      level: 'free' | 'premium';
      expireAt?: string;
    };

    const expireDate = expireAt ? new Date(expireAt) : undefined;
    const user = await adminUserService.updateMembership(
      parseInt(id, 10),
      level,
      expireDate,
    );
    success(reply, { user }, '修改成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
