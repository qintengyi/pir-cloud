import { prisma } from '../../../config/prisma';
import { logger } from '../../../utils/logger';
import { generateActivationCodes } from '../../../utils/crypto';
import { toCsv } from '../../../utils/csv';
import type { ActivationCodeStatus } from '@prisma/client';

/**
 * 管理员 - 激活码管理服务
 */
export class AdminActivationService {
  /**
   * 批量生成激活码
   * @param count 生成数量
   * @param prefix 前缀
   * @param adminId 管理员 ID
   * @returns 生成的激活码数组
   */
  async generateCodes(count: number, prefix: string, adminId: number): Promise<string[]> {
    
    const existingCodes = await prisma.activationCode.findMany({
      select: { code: true },
    });
    const existingSet = new Set(existingCodes.map((c) => c.code));

    const codes = generateActivationCodes(count, prefix, existingSet);

    await prisma.activationCode.createMany({
      data: codes.map((code) => ({
        code,
        status: 'unused' as ActivationCodeStatus,
        created_by: adminId,
      })),
    });

    logger.info({ count, adminId }, 'Activation codes generated');
    return codes;
  }

  /**
   * 查询激活码列表（分页）
   * @param filters 筛选条件
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页激活码列表
   */
  async listCodes(
    filters: { status?: ActivationCodeStatus },
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const [codes, total] = await Promise.all([
      prisma.activationCode.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, nickname: true } },
          device: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.activationCode.count({ where }),
    ]);

    const list = codes.map((c) => ({
      id: c.id,
      code: c.code,
      status: c.status,
      createdBy: c.created_by,
      boundUser: c.user
        ? { id: c.user.id, email: c.user.email, nickname: c.user.nickname }
        : null,
      boundDevice: c.device ? { id: c.device.id, name: c.device.name } : null,
      boundAt: c.bound_at?.toISOString() || null,
      createdAt: c.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 禁用激活码（仅未使用的激活码可禁用）
   * @param codeId 激活码 ID
   */
  async disableCode(codeId: number): Promise<void> {
    const code = await prisma.activationCode.findUnique({
      where: { id: codeId },
    });

    if (!code) {
      const error = new Error('激活码不存在');
      (error as any).code = 2001;
      (error as any).statusCode = 400;
      throw error;
    }

    if (code.status !== 'unused') {
      const error = new Error('仅未使用的激活码可禁用');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    await prisma.activationCode.update({
      where: { id: codeId },
      data: { status: 'disabled' },
    });

    logger.info({ codeId }, 'Activation code disabled');
  }

  /**
   * 导出激活码为 CSV
   * @param filters 筛选条件
   * @returns CSV 字符串
   */
  async exportCodes(filters: { status?: ActivationCodeStatus }): Promise<string> {
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const codes = await prisma.activationCode.findMany({
      where,
      include: {
        user: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      { key: 'code', label: '激活码' },
      { key: 'status', label: '状态' },
      { key: 'boundEmail', label: '绑定用户邮箱' },
      { key: 'boundAt', label: '绑定时间' },
      { key: 'createdAt', label: '生成时间' },
    ];

    const rows = codes.map((c) => ({
      code: c.code,
      status: c.status,
      boundEmail: c.user?.email || '',
      boundAt: c.bound_at?.toLocaleString('zh-CN') || '',
      createdAt: c.created_at.toLocaleString('zh-CN'),
    }));

    return toCsv(headers, rows);
  }
}

export const adminActivationService = new AdminActivationService();
