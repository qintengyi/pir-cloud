import { FastifyReply, FastifyRequest } from 'fastify';
import { firmwareService } from './firmware.service';
import { alistService } from '../alist/alist.service';
import { success } from '../../utils/response';
import type { DeviceType } from '../../types';

/**
 * 公开固件控制器（设备/用户拉取，无需鉴权）
 * 下载端点通过后端代理流式传输 Alist 文件内容（非 302 重定向）
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

/** 下载最新固件（后端代理流式传输） */
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

    const exists = await alistService.fileExists(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    const buffer = await alistService.downloadFile(fw.disk_filename);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${fw.original_name}"`);
    reply.header('Content-Length', String(buffer.length));
    reply.send(buffer);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 按版本号下载固件（后端代理流式传输） */
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

    const exists = await alistService.fileExists(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    const buffer = await alistService.downloadFile(fw.disk_filename);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${fw.original_name}"`);
    reply.header('Content-Length', String(buffer.length));
    reply.send(buffer);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
