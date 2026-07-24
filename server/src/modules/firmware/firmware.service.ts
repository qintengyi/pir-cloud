import { prisma } from '../../config/prisma';
import { alistService } from '../alist/alist.service';

/**
 * 公开固件服务（设备/用户拉取，无需鉴权）
 * 固件文件存储在 Alist 上，下载通过 302 重定向到 Alist 下载地址
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

  /**
   * 解析固件文件的下载地址和存在性
   * @param diskFilename 落盘文件名
   * @returns 下载 URL 和是否存在
   */
  async resolveDiskPath(diskFilename: string): Promise<{ fullPath: string; exists: boolean }> {
    const fullPath = alistService.getDownloadUrl(diskFilename);
    const exists = await alistService.fileExists(diskFilename);
    return { fullPath, exists };
  }
}

export const firmwareService = new FirmwareService();
