import { FastifyReply, FastifyRequest } from 'fastify';
import { deviceService } from './device.service';
import { success, successMessage, paginated, errorWithCode, ErrorCode } from '../../utils/response';
import type { NotifyChannel } from '../../types';

/**
 * 设备模块控制器
 */

/** 设备列表 */
export async function listDevicesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const result = await deviceService.listDevices(userId, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 设备详情 */
export async function getDeviceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const result = await deviceService.getDevice(userId, parseInt(id, 10));
    success(reply, result, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 重命名设备 */
export async function renameDeviceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    const device = await deviceService.renameDevice(userId, parseInt(id, 10), name);
    success(reply, { device }, '修改成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 删除设备 */
export async function deleteDeviceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    await deviceService.deleteDevice(userId, parseInt(id, 10));
    successMessage(reply, '删除成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 绑定设备（激活码） */
export async function bindDeviceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { activationCode } = request.body as { activationCode: string };
    const device = await deviceService.bindDevice(userId, activationCode);
    success(reply, { device }, '绑定成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 设备直连激活（激活码换 device_token）
 *  设备端无 JWT，通过 X-Activation-Code 请求头鉴权（body 字段作为 fallback）
 *  用于 ESP8266 配网后首次连接服务端，用激活码换取 device_token
 */
export async function activateDeviceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    
    const headerCode = request.headers['x-activation-code'] as string | undefined;
    const body = request.body as { activationCode?: string } | null;
    const activationCode = headerCode || body?.activationCode;

    if (!activationCode) {
      errorWithCode(reply, ErrorCode.ACTIVATION_CODE_INVALID, '缺少激活码');
      return;
    }

    const result = await deviceService.activateDevice(activationCode);
    success(reply, result, '激活成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 获取设备配置 */
export async function getDeviceConfigHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const config = await deviceService.getDeviceConfig(userId, parseInt(id, 10));
    success(reply, { config }, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 修改设备配置 */
export async function updateDeviceConfigHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const body = request.body as {
      notifyEnabled?: boolean;
      debounceInterval?: number;
      notifyChannels?: NotifyChannel[];
      onlineRemindEnabled?: boolean;
      onlineRemindIntervalMinutes?: number;
    };
    const config = await deviceService.updateDeviceConfig(userId, parseInt(id, 10), body);
    success(reply, { config }, '修改成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
