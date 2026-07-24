import { FastifyReply, FastifyRequest } from 'fastify';
import { oidcService } from './oidc.service';
import { authService } from '../auth/auth.service';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

/**
 * OIDC 控制器
 * 处理 OIDC 登录发起和回调
 */

/** Cookie 有效期（秒）：10 分钟 */
const COOKIE_MAX_AGE = 600;

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

    reply.setCookie('oidc_code_verifier', codeVerifier, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      secure: config.isProduction,
    });

    reply.setCookie('oidc_state', state, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      secure: config.isProduction,
    });

    logger.info('OIDC login initiated, redirecting to authorization server');
    reply.redirect(302, authUrl);
  } catch (err: any) {
    logger.error({ err }, 'OIDC login initiation failed');
    const errorMsg = encodeURIComponent(err.message || 'OIDC 登录发起失败');
    reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
  }
}

/**
 * OIDC 回调：校验 state，交换 token，获取用户信息，登录或注册，重定向到前端
 */
export async function oidcCallbackHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as { code?: string; state?: string; error?: string };

    // 授权服务器返回错误
    if (query.error) {
      const errorMsg = encodeURIComponent(query.error);
      reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
      return;
    }

    const code = query.code;
    const state = query.state;
    const cookieState = request.cookies.oidc_state;
    const codeVerifier = request.cookies.oidc_code_verifier;

    // 清除 cookie（无论成功失败）
    reply.clearCookie('oidc_code_verifier', { path: '/' });
    reply.clearCookie('oidc_state', { path: '/' });

    // 校验参数完整性
    if (!code || !state) {
      const errorMsg = encodeURIComponent('OIDC 回调缺少必要参数');
      reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
      return;
    }

    // 校验 state（CSRF 防护）
    if (!cookieState || cookieState !== state) {
      logger.warn({ cookieState, state }, 'OIDC state mismatch');
      const errorMsg = encodeURIComponent('OIDC state 校验失败，请重新登录');
      reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
      return;
    }

    if (!codeVerifier) {
      const errorMsg = encodeURIComponent('OIDC code_verifier 缺失，请重新登录');
      reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
      return;
    }

    // 交换 token
    const tokenResponse = await oidcService.exchangeToken(code, codeVerifier);

    // 获取用户信息
    const userInfo = await oidcService.getUserInfo(tokenResponse.access_token);

    // 登录或注册 + 生成 JWT
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
    const errorMsg = encodeURIComponent(err.message || 'OIDC 登录失败');
    reply.redirect(302, `${config.web.url}/auth/oidc/callback#error=${errorMsg}`);
  }
}
