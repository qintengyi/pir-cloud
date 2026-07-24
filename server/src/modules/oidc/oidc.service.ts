import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';
import { hashPassword } from '../../utils/bcrypt';
import type { Prisma } from '@prisma/client';

/**
 * OIDC 认证服务
 * 处理 OIDC PKCE 流程：生成授权 URL、交换 Token、获取用户信息、登录或注册
 * 使用 Node.js 内置 crypto 和 fetch，不引入额外依赖
 */

/** OIDC Token 端点响应 */
interface OidcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

/** OIDC UserInfo 端点响应 */
export interface OidcUserInfo {
  sub: string;
  nickname?: string;
  qq?: string;
}

/** PKCE 密钥对 */
export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export class OidcService {
  /**
   * 生成 PKCE code_verifier 和 code_challenge (S256)
   * @returns PKCE 密钥对
   */
  generatePkce(): PkcePair {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * 生成随机 state 值（用于 CSRF 防护）
   * @returns 32 字符 hex 字符串
   */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 构造 OIDC 授权 URL
   * @param state 随机 state 值
   * @param codeChallenge PKCE code_challenge
   * @returns 完整的授权 URL
   */
  buildAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams();
    params.set('client_id', config.oidc.clientId);
    params.set('redirect_uri', config.oidc.redirectUri);
    params.set('response_type', 'code');
    params.set('scope', config.oidc.scopes);
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
    params.set('state', state);
    return `${config.oidc.issuer}/auth?${params.toString()}`;
  }

  /**
   * 用授权码交换 access_token
   * @param code 授权码
   * @param codeVerifier PKCE code_verifier
   * @returns Token 响应
   */
  async exchangeToken(code: string, codeVerifier: string): Promise<OidcTokenResponse> {
    const basicAuth = Buffer.from(`${config.oidc.clientId}:${config.oidc.clientSecret}`).toString('base64');

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', config.oidc.redirectUri);
    body.set('code_verifier', codeVerifier);

    const response = await fetch(`${config.oidc.issuer}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text }, 'OIDC token exchange failed (HTTP error)');
      const error = new Error('OIDC Token 交换失败');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const tokenData = (await response.json()) as OidcTokenResponse;
    if (!tokenData.access_token) {
      logger.error({ tokenData }, 'OIDC token exchange returned no access_token');
      const error = new Error('OIDC Token 交换失败：未返回 access_token');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    logger.info('OIDC token exchanged successfully');
    return tokenData;
  }

  /**
   * 用 access_token 获取用户信息
   * @param accessToken OIDC access_token
   * @returns 用户信息
   */
  async getUserInfo(accessToken: string): Promise<OidcUserInfo> {
    const response = await fetch(`${config.oidc.issuer}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text }, 'OIDC userinfo fetch failed (HTTP error)');
      const error = new Error('OIDC 用户信息获取失败');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    const userInfo = (await response.json()) as OidcUserInfo;
    if (!userInfo.sub) {
      logger.error({ userInfo }, 'OIDC userinfo returned no sub');
      const error = new Error('OIDC 用户信息无效：缺少 sub 字段');
      (error as any).code = 3004;
      (error as any).statusCode = 401;
      throw error;
    }

    logger.info({ sub: userInfo.sub, hasQq: !!userInfo.qq }, 'OIDC userinfo retrieved');
    return userInfo;
  }

  /**
   * 根据 OIDC 用户信息登录或注册
   * 1. 先按 oidc_sub 查找用户 → 命中返回
   * 2. 再按 qq_number 查找用户 → 命中则更新 oidc_sub 并返回
   * 3. 未命中则创建新用户
   * @param userInfo OIDC 用户信息
   * @returns 数据库用户记录
   */
  async loginOrRegister(userInfo: OidcUserInfo): Promise<Prisma.UserGetPayload<{}>> {
    const { sub, nickname, qq } = userInfo;

    if (!qq) {
      const error = new Error('OIDC 用户信息缺少 QQ 号，无法登录');
      (error as any).code = 4001;
      (error as any).statusCode = 400;
      throw error;
    }

    // 1. 按 oidc_sub 查找
    const existingBySub = await prisma.user.findFirst({
      where: { oidc_sub: sub },
    });
    if (existingBySub) {
      logger.info({ userId: existingBySub.id, sub }, 'OIDC user logged in (matched by oidc_sub)');
      return existingBySub;
    }

    // 2. 按 qq_number 查找
    const existingByQq = await prisma.user.findFirst({
      where: { qq_number: qq },
    });
    if (existingByQq) {
      // 更新 oidc_sub（若尚未设置）
      if (!existingByQq.oidc_sub) {
        const updated = await prisma.user.update({
          where: { id: existingByQq.id },
          data: { oidc_sub: sub },
        });
        logger.info({ userId: updated.id, sub, qq }, 'OIDC user logged in (linked oidc_sub to existing QQ user)');
        return updated;
      }
      logger.info({ userId: existingByQq.id, sub, qq }, 'OIDC user logged in (matched by qq_number)');
      return existingByQq;
    }

    // 3. 创建新用户
    const placeholderEmail = `oidc_${sub}@placeholder.pir-cloud.local`;
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(randomPassword);
    const userNickname = nickname || `QQ用户_${qq.slice(-4)}`;

    const newUser = await prisma.user.create({
      data: {
        email: placeholderEmail,
        password: hashedPassword,
        nickname: userNickname,
        qq_number: qq,
        qq_verified: false,
        email_verified: false,
        oidc_sub: sub,
        membership_level: 'free',
      },
    });

    logger.info({ userId: newUser.id, sub, qq, nickname: userNickname }, 'OIDC new user registered');
    return newUser;
  }
}

export const oidcService = new OidcService();
