import { FastifyReply, FastifyRequest } from 'fastify';
import { authService } from './auth.service';
import { success, successMessage, error, ErrorCode } from '../../utils/response';

/**
 * 认证模块控制器
 * 处理 HTTP 请求/响应，调用 service 层业务逻辑
 */

/**
 * 处理业务错误（带有 code 和 statusCode 属性的 Error）
 * @param reply FastifyReply 实例
 * @param err 错误对象
 */
function handleBusinessError(reply: FastifyReply, err: any): void {
  const code = err.code || ErrorCode.INTERNAL_ERROR.code;
  const statusCode = err.statusCode || ErrorCode.INTERNAL_ERROR.statusCode;
  const message = err.message || ErrorCode.INTERNAL_ERROR.message;
  error(reply, code, message, statusCode);
}

/** 发送验证码 */
export async function sendCodeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { email, type } = request.body as { email: string; type: 'register' | 'reset_password' };
    await authService.sendVerificationCode(email, type);
    successMessage(reply, '验证码已发送');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 用户注册 */
export async function registerHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { email, code, password, nickname } = request.body as {
      email: string;
      code: string;
      password: string;
      nickname?: string;
    };
    const result = await authService.register(email, code, password, nickname);
    success(reply, result, '注册成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 用户登录 */
export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { email, password } = request.body as { email: string; password: string };
    const result = await authService.login(email, password);
    success(reply, result, '登录成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 忘记密码（发送重置验证码） */
export async function forgotPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { email } = request.body as { email: string };
    await authService.forgotPassword(email);
    successMessage(reply, '验证码已发送');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 重置密码 */
export async function resetPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { email, code, newPassword } = request.body as {
      email: string;
      code: string;
      newPassword: string;
    };
    await authService.resetPassword(email, code, newPassword);
    successMessage(reply, '密码重置成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 刷新 token */
export async function refreshHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { refreshToken } = request.body as { refreshToken: string };
    const result = await authService.refreshToken(refreshToken);
    success(reply, result, '刷新成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 退出登录 */
export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { refreshToken } = (request.body as { refreshToken?: string }) || {};
    await authService.logout(userId, refreshToken);
    successMessage(reply, '退出成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}

/** 获取当前用户信息 */
export async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const user = await authService.getMe(userId);
    success(reply, { user }, '获取成功');
  } catch (err: any) {
    handleBusinessError(reply, err);
  }
}
