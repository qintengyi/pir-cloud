import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config/index';
import { errorWithCode, ErrorCode } from '../../utils/response';
import crypto from 'crypto';

/**
 * QQ 归属验证服务
 */
export class QqVerifyService {
  /** 生成 6 位数字验证码 */
  generateCode(): string {
    return Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join('');
  }

  /**
   * 发起验证请求（premium 会员或 OIDC 注册用户 + 已绑 QQ）
   */
  async requestCode(userId: number, qqNumber: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        membership_level: true,
        membership_expire_at: true,
        qq_number: true,
        oidc_sub: true,
      },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const isPremium =
      user.membership_level === 'premium' &&
      (!user.membership_expire_at || user.membership_expire_at > new Date());

    // OIDC 注册用户（oidc_sub 不为空）或付费会员可进行 QQ 验证
    const isOidcUser = !!user.oidc_sub;
    if (!isPremium && !isOidcUser) {
      const error = new Error('仅付费会员或 OIDC 注册用户可进行 QQ 验证');
      (error as any).code = 3002;
      (error as any).statusCode = 403;
      throw error;
    }

    if (!user.qq_number) {
      const error = new Error('请先绑定 QQ 号');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    if (user.qq_number !== qqNumber) {
      const error = new Error('QQ 号与当前绑定信息不一致');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + config.qqVerify.codeExpireMinutes * 60 * 1000);

    // 同一用户同一 QQ 的旧 pending 码作废
    await prisma.qqVerification.updateMany({
      where: {
        user_id: userId,
        qq_number: qqNumber,
        status: 'pending',
      },
      data: { status: 'expired' },
    });

    const record = await prisma.qqVerification.create({
      data: {
        user_id: userId,
        qq_number: qqNumber,
        code,
        status: 'pending',
        expires_at: expiresAt,
      },
    });

    logger.info({ userId, qqNumber, recordId: record.id }, 'QQ verify code generated');

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      botQq: config.qqVerify.botQq,
    };
  }

  /** 查询当前用户 QQ 验证状态 */
  async getStatus(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        qq_number: true,
        qq_verified: true,
        qq_verified_at: true,
      },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    return {
      qqNumber: user.qq_number,
      verified: user.qq_verified,
      verifiedAt: user.qq_verified_at ? user.qq_verified_at.toISOString() : null,
    };
  }

  /**
   * Koishi 回调：QQ 用户向机器人发送验证码后，标记验证成功
   */
  async handleCallback(qqNumber: string, code: string, secret: string) {
    if (secret !== config.qqVerify.callbackSecret) {
      const error = new Error('未授权');
      (error as any).code = 3002;
      (error as any).statusCode = 403;
      throw error;
    }

    const record = await prisma.qqVerification.findFirst({
      where: {
        qq_number: qqNumber,
        code,
        status: 'pending',
      },
      orderBy: { created_at: 'desc' },
    });

    if (!record) {
      return { ok: false, message: '验证码错误或已过期' };
    }

    if (record.expires_at < new Date()) {
      await prisma.qqVerification.update({ where: { id: record.id }, data: { status: 'expired' } });
      return { ok: false, message: '验证码已过期' };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user_id },
        data: {
          qq_verified: true,
          qq_verified_at: new Date(),
        },
      }),
      prisma.qqVerification.update({
        where: { id: record.id },
        data: { status: 'verified' },
      }),
    ]);

    logger.info({ userId: record.user_id, qqNumber }, 'QQ verified successfully');
    return { ok: true, message: 'verified' };
  }
}

export const qqVerifyService = new QqVerifyService();