import { FastifyReply, FastifyRequest } from 'fastify';
import { firmwareService } from './firmware.service';
import { success } from '../../utils/response';
import fs from 'fs';

/**
 * 公开固件控制器（设备/用户拉取，无需鉴权）
 */

/** 获取最新固件版本元数据 */
export async function getLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const latest = await firmwareService.getLatest();
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

/** 下载最新固件 */
export async function downloadLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const fw = await firmwareService.getLatestRecord();
    if (!fw) {
      reply.status(404).send({ code: 4001, message: '暂无可用固件', data: null });
      return;
    }

    const { fullPath, exists } = firmwareService.resolveDiskPath(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    const buffer = fs.readFileSync(fullPath);
    reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', String(buffer.length))
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(fw.original_name)}"`)
      .send(buffer);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 按版本号下载固件 */
export async function downloadByVersionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { version } = request.params as { version: string };
    const fw = await firmwareService.getByVersion(version);
    if (!fw) {
      reply.status(404).send({ code: 4001, message: '固件版本不存在', data: null });
      return;
    }

    const { fullPath, exists } = firmwareService.resolveDiskPath(fw.disk_filename);
    if (!exists) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    const buffer = fs.readFileSync(fullPath);
    reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', String(buffer.length))
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(fw.original_name)}"`)
      .send(buffer);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
