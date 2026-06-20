import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { comparePassword, hashPassword, validatePasswordStrength } from '../../utils/bcrypt';
import type { UserPublicInfo } from '../../types';

/**
 * 用户服务
 * 处理个人信息管理、密码修改、会员查询、QQ绑定等
 */

/**
 * 将数据库用户记录转换为公开信息
 */
function toUserPublicInfo(user: any): UserPublicInfo {
  
  let membershipLevel = user.membership_level;
  if (membershipLevel === 'premium' && user.membership_expire_at && user.membership_expire_at < new Date()) {
    membershipLevel = 'free';
  }

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    membershipLevel,
    membershipExpireAt: user.membership_expire_at ? user.membership_expire_at.toISOString() : null,
    qqNumber: user.qq_number,
    createdAt: user.created_at.toISOString(),
  };
}

export class UserService {
  /**
   * 获取用户个人信息
   * @param userId 用户 ID
   * @returns 用户公开信息
   */
  async getProfile(userId: number): Promise<UserPublicInfo> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    return toUserPublicInfo(user);
  }

  /**
   * 修改昵称
   * @param userId 用户 ID
   * @param nickname 新昵称
   * @returns 更新后的用户信息
   */
  async updateProfile(userId: number, nickname: string): Promise<UserPublicInfo> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { nickname },
    });

    logger.info({ userId, nickname }, 'User profile updated');
    return toUserPublicInfo(user);
  }

  /**
   * 修改密码
   * @param userId 用户 ID
   * @param oldPassword 旧密码
   * @param newPassword 新密码
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    
    if (!validatePasswordStrength(newPassword)) {
      const error = new Error('密码强度不足，需至少8位含字母和数字');
      (error as any).code = 1007;
      (error as any).statusCode = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const isOldPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isOldPasswordValid) {
      const error = new Error('旧密码错误');
      (error as any).code = 1008;
      (error as any).statusCode = 400;
      throw error;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await prisma.refreshToken.deleteMany({
      where: { user_id: userId },
    });

    logger.info({ userId }, 'User password changed');
  }

  /**
   * 获取会员信息
   * @param userId 用户 ID
   * @returns 会员信息
   */
  async getMembership(userId: number): Promise<{
    level: string;
    expireAt: string | null;
    qqBound: boolean;
    isExpired: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        membership_level: true,
        membership_expire_at: true,
        qq_number: true,
      },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const isExpired =
      user.membership_level === 'premium' &&
      user.membership_expire_at != null &&
      user.membership_expire_at < new Date();

    return {
      level: isExpired ? 'free' : user.membership_level,
      expireAt: user.membership_expire_at ? user.membership_expire_at.toISOString() : null,
      qqBound: !!user.qq_number,
      isExpired,
    };
  }

  /**
   * 绑定/修改 QQ 号
   * @param userId 用户 ID
   * @param qqNumber QQ 号
   * @returns 更新后的用户信息
   */
  async updateQQ(userId: number, qqNumber: string): Promise<UserPublicInfo> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { qq_number: qqNumber },
    });

    logger.info({ userId, qqNumber }, 'User QQ number updated');
    return toUserPublicInfo(user);
  }
}

export const userService = new UserService();
