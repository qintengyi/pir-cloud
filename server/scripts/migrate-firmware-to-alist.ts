/**
 * 固件迁移脚本：将本地 firmware_store/ 下的固件文件迁移到 Alist
 *
 * 用法：
 *   npx ts-node scripts/migrate-firmware-to-alist.ts
 *
 * 流程：
 *   1. 读取 firmware_versions 表所有记录
 *   2. 对每条记录，检查本地 firmware_store/ 下是否有 disk_filename 文件
 *   3. 如果有，上传到 Alist
 *   4. 验证上传成功（通过 fileExists 检查）
 *   5. 输出迁移结果
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { alistService } from '../src/modules/alist/alist.service';
import { config } from '../src/config/index';

const prisma = new PrismaClient();

interface MigrationResult {
  id: number;
  version: string;
  diskFilename: string;
  status: 'migrated' | 'skipped' | 'failed';
  message: string;
}

async function main(): Promise<void> {
  console.log('=== 固件迁移到 Alist ===\n');
  console.log(`本地存储目录: ${config.firmware.storeDir}`);
  console.log(`Alist 基础路径: ${config.alist.firmwareBasePath}\n`);

  const firmwares = await prisma.firmwareVersion.findMany({
    orderBy: { created_at: 'asc' },
  });

  console.log(`找到 ${firmwares.length} 条固件记录\n`);

  const results: MigrationResult[] = [];

  for (const fw of firmwares) {
    const localPath = path.join(config.firmware.storeDir, fw.disk_filename);
    const result: MigrationResult = {
      id: fw.id,
      version: fw.version,
      diskFilename: fw.disk_filename,
      status: 'skipped',
      message: '',
    };

    // 检查本地文件是否存在
    if (!fs.existsSync(localPath)) {
      // 检查是否已在 Alist 上
      const existsOnAlist = await alistService.fileExists(fw.disk_filename);
      if (existsOnAlist) {
        result.status = 'skipped';
        result.message = '本地文件不存在，但 Alist 上已有该文件';
      } else {
        result.status = 'failed';
        result.message = '本地文件不存在，Alist 上也没有';
      }
      results.push(result);
      console.log(`[${fw.version}] ${result.message}`);
      continue;
    }

    // 读取本地文件
    let fileBuffer: Buffer;
    try {
      fileBuffer = fs.readFileSync(localPath);
    } catch (err: any) {
      result.status = 'failed';
      result.message = `读取本地文件失败: ${err.message}`;
      results.push(result);
      console.log(`[${fw.version}] ${result.message}`);
      continue;
    }

    // 检查是否已在 Alist 上
    const alreadyExists = await alistService.fileExists(fw.disk_filename);
    if (alreadyExists) {
      result.status = 'skipped';
      result.message = 'Alist 上已有该文件，跳过上传';
      results.push(result);
      console.log(`[${fw.version}] ${result.message}`);
      continue;
    }

    // 上传到 Alist
    try {
      await alistService.uploadFile(fw.disk_filename, fileBuffer);
      result.status = 'migrated';
      result.message = `上传成功 (${fileBuffer.length} bytes)`;
    } catch (err: any) {
      result.status = 'failed';
      result.message = `上传失败: ${err.message}`;
      results.push(result);
      console.log(`[${fw.version}] ${result.message}`);
      continue;
    }

    // 验证上传
    try {
      const verified = await alistService.fileExists(fw.disk_filename);
      if (verified) {
        result.message += '，验证通过';
      } else {
        result.status = 'failed';
        result.message += '，但验证失败（文件未在 Alist 上找到）';
      }
    } catch (err: any) {
      result.message += `，验证时出错: ${err.message}`;
    }

    results.push(result);
    console.log(`[${fw.version}] ${result.message}`);
  }

  // 汇总
  const migrated = results.filter((r) => r.status === 'migrated').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  console.log('\n=== 迁移结果汇总 ===');
  console.log(`总记录数: ${results.length}`);
  console.log(`成功迁移: ${migrated}`);
  console.log(`跳过: ${skipped}`);
  console.log(`失败: ${failed}`);

  if (failed > 0) {
    console.log('\n失败详情:');
    results.filter((r) => r.status === 'failed').forEach((r) => {
      console.log(`  - [${r.version}] ${r.diskFilename}: ${r.message}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('迁移脚本执行失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
