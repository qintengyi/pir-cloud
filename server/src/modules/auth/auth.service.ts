import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { hashPassword, comparePassword, validatePasswordStrength } from '../../utils/bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from '../../utils/jwt';
import { generateVerificationCode } from '../../utils/crypto';
import { EmailService } from '../notification/email.service';
import type { AuthResult, UserPublicInfo, VerificationCodeType } from '../../types';
import type { Prisma } from '@prisma/client';

/**
 * 认证服务
 * 处理注册、登录、密码重置、验证码、Token 管理等认证逻辑
 */

/** 最大登录失败次数 */
const MAX_LOGIN_ATTEMPTS = 5;
/** 锁定时长（分钟） */
const LOCK_DURATION_MINUTES = 15;
/** 验证码有效期（分钟） */
const CODE_EXPIRE_MINUTES = 5;
/** 验证码防重发间隔（秒） */
const CODE_RESEND_INTERVAL_SECONDS = 60;

/**
 * 将数据库用户记录转换为公开信息（去除敏感字段）
 */
function toUserPublicInfo(user: Prisma.UserGetPayload<{}>): UserPublicInfo {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    membershipLevel: user.membership_level,
    membershipExpireAt: user.membership_expire_at ? user.membership_expire_at.toISOString() : null,
    qqNumber: user.qq_number,
    createdAt: user.created_at.toISOString(),
  };
}

export class AuthService {
  /**
   * 发送验证码
   * @param email 邮箱
   * @param type 验证码类型
   */
  async sendVerificationCode(email: string, type: VerificationCodeType): Promise<void> {
    
    const resendThreshold = new Date(Date.now() - CODE_RESEND_INTERVAL_SECONDS * 1000);
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        type,
        created_at: { gt: resendThreshold },
      },
      orderBy: { created_at: 'desc' },
    });

    if (recentCode) {
      const error = new Error('验证码发送过于频繁，请60秒后再试');
      (error as any).code = 1006;
      (error as any).statusCode = 429;
      throw error;
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        email,
        code,
        type,
        expires_at: expiresAt,
      },
    });

    try {
      await EmailService.sendVerificationEmail(email, code, type);
      logger.info({ email, type }, 'Verification code sent');
    } catch (err) {
      logger.error({ err, email }, 'Failed to send verification email');

      if (process.env.NODE_ENV !== 'production') {
        logger.info({ email, code }, 'DEV MODE: Verification code (email send failed)');
      }
      const error = new Error('验证码邮件发送失败，请检查邮箱地址或联系管理员');
      (error as any).code = 5002;
      (error as any).statusCode = 500;
      throw error;
    }
  }

  /**
   * 用户注册
   * @param email 邮箱
   * @param code 验证码
   * @param password 密码
   * @param nickname 昵称（可选）
   * @returns 认证结果（含 token 和用户信息）
   */
  async register(email: string, code: string, password: string, nickname?: string): Promise<AuthResult> {
    
    if (!validatePasswordStrength(password)) {
      const error = new Error('密码强度不足，需至少8位含字母和数字');
      (error as any).code = 1007;
      (error as any).statusCode = 400;
      throw error;
    }

    await this.verifyCode(email, code, 'register');

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('邮箱已注册');
      (error as any).code = 1003;
      (error as any).statusCode = 409;
      throw error;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname: nickname || '用户',
      },
    });

    await prisma.verificationCode.updateMany({
      where: { email, code, type: 'register', used: false },
      data: { used: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    logger.info({ userId: user.id, email }, 'User registered successfully');

    return {
      ...tokens,
      user: toUserPublicInfo(user),
    };
  }

  /**
   * 用户登录
   * @param email 邮箱
   * @param password 密码
   * @returns 认证结果（含 token 和用户信息）
   */
  async login(email: string, password: string): Promise<AuthResult> {
    
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const error = new Error('邮箱或密码错误');
      (error as any).code = 1001;
      (error as any).statusCode = 401;
      throw error;
    }

    if (user.locked_until && user.locked_until > new Date()) {
      const error = new Error(`账号已锁定，请至 ${user.locked_until.toLocaleString('zh-CN')} 后再试`);
      (error as any).code = 1002;
      (error as any).statusCode = 403;
      throw error;
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      
      const failCount = user.login_fail_count + 1;

      if (failCount >= MAX_LOGIN_ATTEMPTS) {
        
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            login_fail_count: 0,
            locked_until: lockedUntil,
          },
        });

        logger.warn({ userId: user.id, email }, 'Account locked due to too many failed attempts');
        const error = new Error('密码错误次数过多，账号已锁定15分钟');
        (error as any).code = 1002;
        (error as any).statusCode = 403;
        throw error;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { login_fail_count: failCount },
      });

      const error = new Error(`邮箱或密码错误，还剩 ${MAX_LOGIN_ATTEMPTS - failCount} 次尝试机会`);
      (error as any).code = 1001;
      (error as any).statusCode = 401;
      throw error;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        login_fail_count: 0,
        locked_until: null,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    logger.info({ userId: user.id, email }, 'User logged in successfully');

    return {
      ...tokens,
      user: toUserPublicInfo(user),
    };
  }

  /**
   * 忘记密码（发送重置验证码）
   * @param email 邮箱
   */
  async forgotPassword(email: string): Promise<void> {

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      logger.info({ email }, 'Forgot password requested for non-existent email (silent ignore)');
      return;
    }

    await this.sendVerificationCode(email, 'reset_password');
  }

  /**
   * 重置密码
   * @param email 邮箱
   * @param code 验证码
   * @param newPassword 新密码
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    
    if (!validatePasswordStrength(newPassword)) {
      const error = new Error('密码强度不足，需至少8位含字母和数字');
      (error as any).code = 1007;
      (error as any).statusCode = 400;
      throw error;
    }

    await this.verifyCode(email, code, 'reset_password');

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({
        where: { user_id: user.id },
      });
    }

    logger.info({ email }, 'Password reset successfully');
  }

  /**
   * 刷新 access_token
   * @param refreshTokenStr refresh_token 字符串
   * @returns 新的 token 对
   */
  async refreshToken(refreshTokenStr: string): Promise<{ accessToken: string; refreshToken: string }> {
    
    const payload = verifyRefreshToken(refreshTokenStr);
    if (!payload) {
      const error = new Error('Token无效或已过期');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
    });

    if (!storedToken) {
      const error = new Error('Token已失效，请重新登录');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    if (storedToken.expires_at < new Date()) {
      
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      const error = new Error('Token已过期，请重新登录');
      (error as any).code = 3003;
      (error as any).statusCode = 401;
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      const error = new Error('用户不存在');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.generateTokens(user.id, user.email, user.role);
  }

  /**
   * 退出登录
   * @param userId 用户 ID
   * @param refreshTokenStr refresh_token 字符串（可选）
   */
  async logout(userId: number, refreshTokenStr?: string): Promise<void> {
    if (refreshTokenStr) {
      
      await prisma.refreshToken.deleteMany({
        where: { user_id: userId, token: refreshTokenStr },
      });
    } else {
      
      await prisma.refreshToken.deleteMany({
        where: { user_id: userId },
      });
    }

    logger.info({ userId }, 'User logged out');
  }

  /**
   * 获取当前用户信息
   * @param userId 用户 ID
   * @returns 用户公开信息
   */
  async getMe(userId: number): Promise<UserPublicInfo> {
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
   * 验证验证码
   * @param email 邮箱
   * @param code 验证码
   * @param type 验证码类型
   */
  private async verifyCode(email: string, code: string, type: VerificationCodeType): Promise<void> {
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type,
        used: false,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!verificationCode) {
      const error = new Error('验证码错误');
      (error as any).code = 1004;
      (error as any).statusCode = 400;
      throw error;
    }

    if (verificationCode.expires_at < new Date()) {
      const error = new Error('验证码已过期，请重新获取');
      (error as any).code = 1005;
      (error as any).statusCode = 400;
      throw error;
    }

    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true },
    });
  }

  /**
   * 生成 access_token 和 refresh_token，并存储 refresh_token 到数据库
   * @param userId 用户 ID
   * @param email 邮箱
   * @param role 角色
   * @returns token 对
   */
  private async generateTokens(
    userId: number,
    email: string,
    role: 'user' | 'admin',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = signAccessToken({ userId, email, role });
    const refreshToken = signRefreshToken({ userId, token: '' });

    await prisma.refreshToken.create({
      data: {
        user_id: userId,
        token: refreshToken,
        expires_at: getRefreshTokenExpiry(),
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
