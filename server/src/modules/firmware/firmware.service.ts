import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/prisma';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

/**
 * 公开固件服务（设备/用户拉取，无需鉴权）
 */
export class FirmwareService {
  /** 获取最新固件版本元数据 */
  async getLatest() {
    const fw = await prisma.firmwareVersion.findFirst({
      where: { is_latest: true },
      orderBy: { created_at: 'desc' },
    });
    if (!fw) return null;
    return {
      id: fw.id,
      version: fw.version,
      originalName: fw.original_name,
      fileSize: fw.file_size,
      checksum: fw.checksum,
      changelog: fw.changelog,
      createdAt: fw.created_at.toISOString(),
      downloadUrl: '/api/firmware/download/latest',
    };
  }

  /** 取最新固件记录（用于下载） */
  async getLatestRecord() {
    return prisma.firmwareVersion.findFirst({
      where: { is_latest: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /** 按版本号取固件记录 */
  async getByVersion(version: string) {
    return prisma.firmwareVersion.findUnique({ where: { version } });
  }

  /** 还原磁盘路径 */
  resolveDiskPath(diskFilename: string): { fullPath: string; exists: boolean } {
    const fullPath = path.join(config.firmware.storeDir, diskFilename);
    return { fullPath, exists: fs.existsSync(fullPath) };
  }
}

export const firmwareService = new FirmwareService();
