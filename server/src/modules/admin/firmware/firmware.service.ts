import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../../config/prisma';
import { logger } from '../../../utils/logger';
import { config } from '../../../config/index';
import { alistService } from '../../alist/alist.service';
import type { DeviceType } from '../../../types';

/**
 * 管理员 - 固件版本管理服务
 * 负责固件 bin 文件的上传、列表、删除、设为最新、下载
 * 固件文件存储在 Alist 上，不再使用本地文件系统
 */
export class AdminFirmwareService {

  /** 生成唯一落盘文件名：<时间戳>_<随机>_<安全化的原始名> */
  private buildDiskFilename(originalName: string): string {
    const safeBase = path.basename(originalName).replace(/[^\w.-]/g, '_') || 'firmware.bin';
    const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return `${id}_${safeBase}`;
  }

  /**
   * 上传固件版本
   * @param fileBuffer 固件文件内容（已读入内存，multipart toBuffer）
   * @param filename 原始文件名
   * @param version 版本号
   * @param changelog 更新日志
   * @param isLatest 是否设为最新
   * @param adminId 管理员 ID
   * @param deviceType 设备类型（默认 infrared）
   */
  async uploadFirmware(
    fileBuffer: Buffer,
    filename: string,
    version: string,
    changelog: string | undefined,
    isLatest: boolean,
    adminId: number,
    deviceType: DeviceType = 'infrared',
  ): Promise<{ id: number; version: string; originalName: string; fileSize: number; checksum: string; isLatest: boolean; deviceType: DeviceType }> {
    // 版本号唯一性校验（联合唯一：version + device_type）
    const existing = await prisma.firmwareVersion.findUnique({
      where: { version_device_type: { version, device_type: deviceType } },
    });
    if (existing) {
      const error = new Error('固件版本号已存在');
      (error as any).code = 4001;
      (error as any).statusCode = 409;
      throw error;
    }

    // 大小校验
    if (fileBuffer.length > config.firmware.maxSize) {
      const error = new Error('固件文件超过最大限制');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    const originalName = filename || `firmware_${version}.bin`;
    const diskFilename = this.buildDiskFilename(originalName);

    // 上传到 Alist
    try {
      await alistService.uploadFile(diskFilename, fileBuffer);
    } catch (err: any) {
      const error = new Error(err.message || '固件文件上传失败');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    const fileSize = fileBuffer.length;
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 写库 + 设最新（事务）
    const record = await prisma.$transaction(async (tx) => {
      if (isLatest) {
        // 仅清除同 device_type 的其它最新标记
        await tx.firmwareVersion.updateMany({
          where: { is_latest: true, device_type: deviceType },
          data: { is_latest: false },
        });
      }
      return tx.firmwareVersion.create({
        data: {
          version,
          original_name: originalName,
          disk_filename: diskFilename,
          file_size: fileSize,
          checksum,
          is_latest: isLatest,
          changelog: changelog || null,
          created_by: adminId,
          device_type: deviceType,
        },
      });
    });

    logger.info({ id: record.id, version, fileSize, checksum, isLatest, adminId, deviceType }, 'Firmware version uploaded to Alist');
    return {
      id: record.id,
      version: record.version,
      originalName: record.original_name,
      fileSize: record.file_size,
      checksum: record.checksum,
      isLatest: record.is_latest,
      deviceType: record.device_type,
    };
  }

  /**
   * 固件版本列表（分页）
   * @param page 页码
   * @param pageSize 每页条数
   * @param deviceType 设备类型过滤（可选）
   */
  async listFirmwares(page: number, pageSize: number, deviceType?: DeviceType) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (deviceType) where.device_type = deviceType;

    const [items, total] = await Promise.all([
      prisma.firmwareVersion.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: { creator: { select: { id: true, nickname: true } } },
      }),
      prisma.firmwareVersion.count({ where }),
    ]);

    const list = items.map((f) => ({
      id: f.id,
      version: f.version,
      originalName: f.original_name,
      fileSize: f.file_size,
      checksum: f.checksum,
      isLatest: f.is_latest,
      deviceType: f.device_type,
      changelog: f.changelog,
      createdBy: f.created_by,
      createdByName: f.creator?.nickname || null,
      createdAt: f.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 设为最新版本（事务：先清除同类型其它最新，再置当前）
   * 清除范围限定同 device_type，红外和微波各自有独立的"最新固件"
   */
  async setLatest(firmwareId: number): Promise<void> {
    const fw = await prisma.firmwareVersion.findUnique({ where: { id: firmwareId } });
    if (!fw) {
      const error = new Error('固件版本不存在');
      (error as any).code = 4001;
      (error as any).statusCode = 404;
      throw error;
    }

    await prisma.$transaction([
      // 仅清除同 device_type 的其它最新标记
      prisma.firmwareVersion.updateMany({
        where: { is_latest: true, device_type: fw.device_type },
        data: { is_latest: false },
      }),
      prisma.firmwareVersion.update({ where: { id: firmwareId }, data: { is_latest: true } }),
    ]);

    logger.info({ firmwareId, version: fw.version, deviceType: fw.device_type }, 'Firmware set as latest');
  }

  /** 删除固件版本（连 Alist 文件一起删） */
  async deleteFirmware(firmwareId: number): Promise<void> {
    const fw = await prisma.firmwareVersion.findUnique({ where: { id: firmwareId } });
    if (!fw) {
      const error = new Error('固件版本不存在');
      (error as any).code = 4001;
      (error as any).statusCode = 404;
      throw error;
    }

    try {
      await alistService.deleteFile(fw.disk_filename);
    } catch (err: any) {
      // 文件删除失败仅记录日志，不阻断删除流程
      logger.warn({ err, diskFilename: fw.disk_filename }, 'Failed to delete firmware from Alist');
    }

    await prisma.firmwareVersion.delete({ where: { id: firmwareId } });
    logger.info({ firmwareId, version: fw.version }, 'Firmware version deleted');
  }

  /** 取固件记录（供下载用） */
  async getFirmware(firmwareId: number) {
    return prisma.firmwareVersion.findUnique({ where: { id: firmwareId } });
  }

  /**
   * 解析固件文件的下载地址和存在性
   * @param fw 固件记录（含 disk_filename）
   * @returns 下载 URL 和是否存在
   */
  async resolveDiskPath(fw: { disk_filename: string }): Promise<{ fullPath: string; exists: boolean }> {
    const fullPath = alistService.getDownloadUrl(fw.disk_filename);
    const exists = await alistService.fileExists(fw.disk_filename);
    return { fullPath, exists };
  }
}

export const adminFirmwareService = new AdminFirmwareService();
