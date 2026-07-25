import { FastifyReply, FastifyRequest } from 'fastify';
import { oidcService } from './oidc.service';
import { authService } from '../auth/auth.service';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

/**
 * OIDC 控制器
 * 处理 OIDC 登录发起、回调、绑定发起
 */

/** Cookie 有效期（秒）：10 分钟 */
const COOKIE_MAX_AGE = 600;

/** Cookie 通用配置 */
const cookieOptions = {
  httpOnly: true,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
  sameSite: 'lax' as const,
  secure: config.isProduction,
};

/**
 * OIDC 登录发起：生成 PKCE + state，设置 cookie，重定向到授权 URL
 */
export async function oidcLoginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { codeVerifier, codeChallenge } = oidcService.generatePkce();
    const state = oidcService.generateState();
    const authUrl = oidcService.buildAuthUrl(state, codeChallenge);

    reply.setCookie('oidc_code_verifier', codeVerifier, cookieOptions);
    reply.setCookie('oidc_state', state, cookieOptions);

    logger.info('OIDC login initiated, redirecting to authorization server');
    reply.redirect(302, authUrl);
  } catch (err: any) {
    logger.error({ err }, 'OIDC login initiation failed');
    const errorMsg = encodeURIComponent(err.message || 'OIDC 登录发起失败');
    reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
  }
}

/**
 * OIDC 绑定发起：生成 PKCE + state，设置 4 个 cookie（含绑定模式标记），重定向到授权 URL
 * 需要登录态（authMiddleware 已验证 request.user）
 */
export async function oidcBindInitHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { codeVerifier, codeChallenge } = oidcService.generatePkce();
    const state = oidcService.generateState();
    const authUrl = oidcService.buildAuthUrl(state, codeChallenge);

    reply.setCookie('oidc_code_verifier', codeVerifier, cookieOptions);
    reply.setCookie('oidc_state', state, cookieOptions);
    reply.setCookie('oidc_bind_mode', 'true', cookieOptions);
    reply.setCookie('oidc_bind_user_id', String(userId), cookieOptions);

    logger.info({ userId }, 'OIDC bind initiated, redirecting to authorization server');
    reply.redirect(302, authUrl);
  } catch (err: any) {
    logger.error({ err }, 'OIDC bind initiation failed');
    const errorMsg = encodeURIComponent(err.message || 'OIDC 绑定发起失败');
    reply.redirect(302, `${config.web.url}/profile?oidc_bind=error&msg=${errorMsg}`);
  }
}

/**
 * OIDC 回调：校验 state，交换 token，获取用户信息
 * - 绑定模式：将 OIDC 账号绑定到当前用户，重定向到 /profile?oidc_bind=success|error
 * - 登录模式（现有逻辑）：登录或注册，重定向到 /auth/oidc/callback#access_token=...
 */
export async function oidcCallbackHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 读取绑定模式相关 cookie
  const isBindMode = request.cookies.oidc_bind_mode === 'true';
  const bindUserIdStr = request.cookies.oidc_bind_user_id;
  const bindUserId = bindUserIdStr ? parseInt(bindUserIdStr, 10) : null;

  /**
   * 构建错误重定向 URL（根据模式不同）
   * - 绑定模式：重定向到 /profile?oidc_bind=error&msg=xxx
   * - 登录模式：重定向到 /auth/oidc/callback#error=xxx
   */
  const buildErrorRedirect = (msg: string): string => {
    const errorMsg = encodeURIComponent(msg);
    if (isBindMode && bindUserId) {
      return `${config.web.url}/profile?oidc_bind=error&msg=${errorMsg}`;
    }
    return `${config.web.url}/auth/oidc/callback#error=${errorMsg}`;
  };

  try {
    const query = request.query as { code?: string; state?: string; error?: string };

    // 授权服务器返回错误
    if (query.error) {
      // 清除所有 OIDC cookie
      reply.clearCookie('oidc_code_verifier', { path: '/' });
      reply.clearCookie('oidc_state', { path: '/' });
      reply.clearCookie('oidc_bind_mode', { path: '/' });
      reply.clearCookie('oidc_bind_user_id', { path: '/' });
      reply.redirect(302, buildErrorRedirect(query.error));
      return;
    }

    const code = query.code;
    const state = query.state;
    const cookieState = request.cookies.oidc_state;
    const codeVerifier = request.cookies.oidc_code_verifier;

    // 清除所有 cookie（无论成功失败）
    reply.clearCookie('oidc_code_verifier', { path: '/' });
    reply.clearCookie('oidc_state', { path: '/' });
    reply.clearCookie('oidc_bind_mode', { path: '/' });
    reply.clearCookie('oidc_bind_user_id', { path: '/' });

    // 校验参数完整性
    if (!code || !state) {
      reply.redirect(302, buildErrorRedirect('OIDC 回调缺少必要参数'));
      return;
    }

    // 校验 state（CSRF 防护）
    if (!cookieState || cookieState !== state) {
      logger.warn({ cookieState, state }, 'OIDC state mismatch');
      reply.redirect(302, buildErrorRedirect('OIDC state 校验失败，请重新操作'));
      return;
    }

    if (!codeVerifier) {
      reply.redirect(302, buildErrorRedirect('OIDC code_verifier 缺失，请重新操作'));
      return;
    }

    // 交换 token
    const tokenResponse = await oidcService.exchangeToken(code, codeVerifier);

    // 获取用户信息
    const userInfo = await oidcService.getUserInfo(tokenResponse.access_token);

    // ===== 绑定模式：将 OIDC 账号绑定到当前用户 =====
    if (isBindMode && bindUserId) {
      try {
        await authService.bindOidc(bindUserId, userInfo.sub, userInfo.qq);
        logger.info({ userId: bindUserId, oidcSub: userInfo.sub }, 'OIDC bind successful, redirecting to profile');
        reply.redirect(302, `${config.web.url}/profile?oidc_bind=success`);
      } catch (bindErr: any) {
        logger.error({ err: bindErr, userId: bindUserId }, 'OIDC bind failed');
        const errorMsg = encodeURIComponent(bindErr.message || 'OIDC 绑定失败');
        reply.redirect(302, `${config.web.url}/profile?oidc_bind=error&msg=${errorMsg}`);
      }
      return;
    }

    // ===== 登录模式（现有逻辑）=====
    const result = await authService.oidcLogin(userInfo);

    // 构造前端重定向 URL（token 放在 hash 中，不发送到服务器）
    const params = new URLSearchParams();
    params.set('access_token', result.accessToken);
    params.set('refresh_token', result.refreshToken);
    params.set('need_bind_email', String(result.needBindEmail));

    const redirectUrl = `${config.web.url}/auth/oidc/callback#${params.toString()}`;
    logger.info({ userId: result.user.id, needBindEmail: result.needBindEmail }, 'OIDC callback success, redirecting to frontend');

    reply.redirect(302, redirectUrl);
  } catch (err: any) {
    logger.error({ err }, 'OIDC callback failed');
    reply.redirect(302, buildErrorRedirect(err.message || 'OIDC 操作失败'));
  }
}
