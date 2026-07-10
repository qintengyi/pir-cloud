import { FastifyReply, FastifyRequest } from 'fastify';
import { qqVerifyService } from './qq-verify.service';
import { success } from '../../utils/response';

/**
 * QQ 验证控制器
 */
export async function requestQqVerifyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const userId = request.user.id;
    const { qqNumber } = request.body as { qqNumber: string };
    const result = await qqVerifyService.requestCode(userId, qqNumber);
    success(reply, result, '验证码已生成');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

export async function getQqVerifyStatusHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const userId = request.user.id;
    const result = await qqVerifyService.getStatus(userId);
    success(reply, result, '查询成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

export async function qqVerifyCallbackHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const secret = (request.headers['x-verify-secret'] as string) || '';
    const { qqNumber, code } = request.body as { qqNumber: string; code: string };
    const result = await qqVerifyService.handleCallback(qqNumber, code, secret);
    success(reply, result, result.ok ? '验证成功' : '验证失败');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
