import { FastifyReply, FastifyRequest } from 'fastify';
import { reportService } from './report.service';
import { successMessage } from '../../utils/response';

/**
 * 上报模块控制器
 */

/** 数据上报 */
export async function reportHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    
    const deviceToken = request.headers['x-device-token'] as string | undefined;
    const activationCode = request.headers['x-activation-code'] as string | undefined;

    const data = request.body as {
      status: 'presence' | 'absence';
      timestamp?: number;
      rssi?: number;
      extra?: Record<string, any>;
    };

    const result = await reportService.handleReport(deviceToken, activationCode, data);
    successMessage(reply, result.message);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 心跳 */
export async function heartbeatHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const deviceToken = request.headers['x-device-token'] as string | undefined;
    const body = request.body as { timestamp?: number; rssi?: number } | null;
    await reportService.handleHeartbeat(deviceToken, body || {});
    successMessage(reply, '心跳成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
