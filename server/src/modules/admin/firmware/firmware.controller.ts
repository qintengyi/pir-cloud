import { FastifyReply, FastifyRequest } from 'fastify';
import { adminFirmwareService } from './firmware.service';
import { alistService } from '../../alist/alist.service';
import { success, paginated } from '../../../utils/response';
import type { DeviceType } from '../../../types';

/**
 * 管理员 - 固件版本管理控制器
 */

/** 上传固件版本（multipart/form-data） */
export async function uploadFirmwareHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // 使用 parts() 遍历所有字段，顺序无关（version/changelog/isLatest/deviceType/file 可任意顺序）
    let version: string | undefined;
    let changelog: string | undefined;
    let isLatest = false;
    let deviceType: DeviceType = 'infrared';
    let fileBuffer: Buffer | null = null;
    let fileFilename: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        // 取第一个文件部分（不支持多文件）。
        // 必须在循环内消耗该流，否则 @fastify/multipart 不会推进到下一个 part，
        // 请求会挂起。固件最大 4MB，toBuffer 进内存可接受。
        if (fileBuffer === null) {
          fileBuffer = await part.toBuffer();
          fileFilename = part.filename;
        } else {
          // 多余的文件部分，消耗掉避免 stream 堆积
          await part.toBuffer();
        }
      } else {
        // 文本字段：转成字符串
        const val = (part as any).value as Buffer | string | undefined;
        const str = typeof val === 'string' ? val : val?.toString('utf8');
        if (part.fieldname === 'version') version = str;
        else if (part.fieldname === 'changelog') changelog = str;
        else if (part.fieldname === 'isLatest') isLatest = str === 'true' || str === '1';
        else if (part.fieldname === 'deviceType' && (str === 'infrared' || str === 'microwave')) deviceType = str;
      }
    }

    if (!fileBuffer) {
      reply.status(400).send({ code: 4001, message: '缺少固件文件', data: null });
      return;
    }
    if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
      reply.status(400).send({ code: 4001, message: '版本号格式错误（如 1.0.0）', data: null });
      return;
    }

    const adminId = request.user.id;
    const result = await adminFirmwareService.uploadFirmware(
      fileBuffer,
      fileFilename || `firmware_${version}.bin`,
      version,
      changelog,
      isLatest,
      adminId,
      deviceType,
    );
    success(reply, result, '上传成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 固件版本列表 */
export async function listFirmwaresHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as { page?: string; pageSize?: string; deviceType?: DeviceType };
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);
    const result = await adminFirmwareService.listFirmwares(page, pageSize, query.deviceType);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 设为最新 */
export async function setLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    await adminFirmwareService.setLatest(parseInt(id, 10));
    success(reply, null, '已设为最新版本');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 删除固件版本 */
export async function deleteFirmwareHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    await adminFirmwareService.deleteFirmware(parseInt(id, 10));
    success(reply, null, '删除成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 下载固件（管理员按 id 下载任意版本，后端代理流式传输） */
export async function downloadFirmwareHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const fw = await adminFirmwareService.getFirmware(parseInt(id, 10));
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
