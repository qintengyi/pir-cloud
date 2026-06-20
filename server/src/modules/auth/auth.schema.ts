/**
 * 认证模块 JSON Schema 定义
 * 用于 Fastify 路由参数校验
 */

/** 发送验证码 */
export const sendCodeSchema = {
  body: {
    type: 'object',
    required: ['email', 'type'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      type: { type: 'string', enum: ['register', 'reset_password'] },
      turnstileToken: { type: 'string' },
    },
  },
};

/** 用户注册 */
export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'code', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      code: { type: 'string', minLength: 6, maxLength: 6 },
      password: { type: 'string', minLength: 8, maxLength: 64 },
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
      turnstileToken: { type: 'string' },
    },
  },
};

/** 用户登录 */
export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 64 },
      turnstileToken: { type: 'string' },
    },
  },
};

/** 忘记密码（发送重置验证码） */
export const forgotPasswordSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      turnstileToken: { type: 'string' },
    },
  },
};

/** 重置密码 */
export const resetPasswordSchema = {
  body: {
    type: 'object',
    required: ['email', 'code', 'newPassword'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      code: { type: 'string', minLength: 6, maxLength: 6 },
      newPassword: { type: 'string', minLength: 8, maxLength: 64 },
    },
  },
};

/** 刷新 token */
export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string', minLength: 1, maxLength: 512 },
    },
  },
};
