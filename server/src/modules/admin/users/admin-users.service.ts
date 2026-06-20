import { prisma } from '../../../config/prisma';
import { logger } from '../../../utils/logger';
import type { MembershipLevel } from '@prisma/client';

/**
 * 管理员 - 用户管理服务
 */
export class AdminUserService {
  /**
   * 查询用户列表（分页，支持搜索）
   * @param search 搜索关键词（邮箱/昵称）
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页用户列表
   */
  async listUsers(search: string | undefined, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { nickname: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          membership_level: true,
          membership_expire_at: true,
          created_at: true,
          _count: {
            select: { devices: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const list = users.map((u) => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      membershipLevel: u.membership_level,
      membershipExpireAt: u.membership_expire_at?.toISOString() || null,
      deviceCount: u._count.devices,
      createdAt: u.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取用户详情
   * @param userId 用户 ID
   * @returns 用户详情和设备数
   */
  async getUserDetail(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        membership_level: true,
        membership_expire_at: true,
        qq_number: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { devices: true, orders: true },
        },
      },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 404;
      throw error;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        membershipLevel: user.membership_level,
        membershipExpireAt: user.membership_expire_at?.toISOString() || null,
        qqNumber: user.qq_number,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
      },
      deviceCount: user._count.devices,
      orderCount: user._count.orders,
    };
  }

  /**
   * 修改用户会员等级
   * @param userId 用户 ID
   * @param level 会员等级
   * @param expireAt 过期时间
   * @returns 更新后的用户信息
   */
  async updateMembership(
    userId: number,
    level: MembershipLevel,
    expireAt: Date | undefined,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 404;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        membership_level: level,
        membership_expire_at: level === 'premium' ? expireAt || null : null,
      },
    });

    logger.info({ userId, level, expireAt, adminId: 'system' }, 'User membership updated');

    return {
      id: updated.id,
      email: updated.email,
      nickname: updated.nickname,
      role: updated.role,
      membershipLevel: updated.membership_level,
      membershipExpireAt: updated.membership_expire_at?.toISOString() || null,
      createdAt: updated.created_at.toISOString(),
    };
  }
}

export const adminUserService = new AdminUserService();
