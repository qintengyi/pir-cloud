import { FastifyReply, FastifyRequest } from 'fastify';
import { userService } from './user.service';
import { success, successMessage } from '../../utils/response';

/**
 * 用户模块控制器
 */

/** 获取个人信息 */
export async function getProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const user = await userService.getProfile(userId);
    success(reply, { user }, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 修改昵称 */
export async function updateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { nickname } = request.body as { nickname: string };
    const user = await userService.updateProfile(userId, nickname);
    success(reply, { user }, '修改成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 修改密码 */
export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { oldPassword, newPassword } = request.body as {
      oldPassword: string;
      newPassword: string;
    };
    await userService.changePassword(userId, oldPassword, newPassword);
    successMessage(reply, '密码修改成功，请重新登录');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 获取会员信息 */
export async function getMembershipHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const membership = await userService.getMembership(userId);
    success(reply, { membership }, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 绑定 QQ 号 */
export async function updateQQHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { qqNumber } = request.body as { qqNumber: string };
    const user = await userService.updateQQ(userId, qqNumber);
    success(reply, { user }, '绑定成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
