import { FastifyReply, FastifyRequest } from 'fastify';
import { firmwareService } from './firmware.service';
import { success } from '../../utils/response';
import type { DeviceType } from '../../types';

/**
 * 公开固件控制器（设备/用户拉取，无需鉴权）
 * 下载端点通过 302 重定向到 Alist 下载地址
 */

/** 获取最新固件版本元数据 */
export async function getLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { deviceType } = request.query as { deviceType?: DeviceType };
    const latest = await firmwareService.getLatest(deviceType);
    if (!latest) {
      reply.status(404).send({ code: 4001, message: '暂无可用固件', data: null });
      return;
    }
    success(reply, latest, '查询成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 下载最新固件（302 重定向到 Alist 下载地址） */
export async function downloadLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { deviceType } = request.query as { deviceType?: DeviceType };
    const fw = await firmwareService.getLatestRecord(deviceType);
    if (!fw) {
      reply.status(404).send({ code: 4001, message: '暂无可用固件', data: null });
      return;
    }

    const { fullPath, exists } = await firmwareService.resolveDiskPath(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    reply.redirect(302, fullPath);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 按版本号下载固件（302 重定向到 Alist 下载地址） */
export async function downloadByVersionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { version } = request.params as { version: string };
    const { deviceType } = request.query as { deviceType?: DeviceType };
    const fw = await firmwareService.getByVersion(version, deviceType);
    if (!fw) {
      reply.status(404).send({ code: 4001, message: '固件版本不存在', data: null });
      return;
    }

    const { fullPath, exists } = await firmwareService.resolveDiskPath(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    reply.redirect(302, fullPath);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
