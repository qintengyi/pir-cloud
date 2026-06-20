import { FastifyReply, FastifyRequest } from 'fastify';
import { adminSettingsService } from './settings.service';
import { success, successMessage } from '../../../utils/response';

/**
 * 管理员 - 系统配置控制器
 */

/** 获取系统配置 */
export async function getConfigsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const configs = await adminSettingsService.getConfigs();
    success(reply, configs, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 更新 SMTP 配置 */
export async function updateSmtpHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const adminId = request.user.id;
    const body = request.body as {
      host: string;
      port: number;
      username: string;
      password: string;
      from: string;
      secure?: boolean;
    };

    await adminSettingsService.updateSmtpConfig(
      {
        host: body.host,
        port: body.port,
        username: body.username,
        password: body.password,
        from: body.from,
        secure: body.secure ?? body.port === 465,
      },
      adminId,
    );

    successMessage(reply, '保存成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 更新 OneBot 配置 */
export async function updateOneBotHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const adminId = request.user.id;
    const { wsUrl, token } = request.body as { wsUrl: string; token?: string };

    await adminSettingsService.updateOneBotConfig(
      { wsUrl, token: token || '' },
      adminId,
    );

    successMessage(reply, '保存成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 测试 SMTP 发送 */
export async function testSmtpHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { to } = request.body as { to: string };
    await adminSettingsService.testSmtp(to);
    successMessage(reply, '测试邮件已发送');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 测试 OneBot 连接 */
export async function testOneBotHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await adminSettingsService.testOneBot();
    successMessage(reply, '连接成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
