import { z } from 'zod';

/**
 * 表单校验规则（使用 zod）
 */

/** 邮箱校验 */
export const emailSchema = z
  .string()
  .min(1, '请输入邮箱地址')
  .email('邮箱格式不正确');

/** 密码校验（至少8位，含字母和数字） */
export const passwordSchema = z
  .string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码需包含字母')
  .regex(/[0-9]/, '密码需包含数字');

/** 验证码校验（6位数字） */
export const verificationCodeSchema = z
  .string()
  .length(6, '验证码为6位数字')
  .regex(/^\d{6}$/, '验证码为6位数字');

/** 昵称校验 */
export const nicknameSchema = z
  .string()
  .min(1, '请输入昵称')
  .max(50, '昵称最多50个字符');

/** QQ号校验 */
export const qqNumberSchema = z
  .string()
  .regex(/^[0-9]{5,12}$/, 'QQ号为5-12位数字');

/** 激活码校验 */
export const activationCodeSchema = z
  .string()
  .min(1, '请输入激活码')
  .max(32, '激活码格式不正确');

/** 登录表单 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码'),
});

/** 注册表单 */
export const registerSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
  password: passwordSchema,
  nickname: z.string().max(50, '昵称最多50个字符').optional(),
});

/** 找回密码表单 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
  newPassword: passwordSchema,
});

/** 修改密码表单 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: passwordSchema,
});

/** 生成激活码表单 */
export const generateCodesSchema = z.object({
  count: z.number().int().min(1, '至少生成1个').max(100, '单次最多100个'),
  prefix: z.string().max(10, '前缀最多10个字符').optional(),
});

/** SMTP 配置表单 */
export const smtpConfigSchema = z.object({
  host: z.string().min(1, '请输入SMTP服务器地址'),
  port: z.number().int().min(1, '端口不合法').max(65535, '端口不合法'),
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
  from: z.string().min(1, '请输入发件人地址').email('发件人邮箱格式不正确'),
  secure: z.boolean(),
});

/** OneBot 配置表单 */
export const onebotConfigSchema = z.object({
  wsUrl: z.string().min(1, '请输入WebSocket地址'),
  token: z.string().optional(),
});

/** 手动创建订单表单 */
export const createOrderSchema = z.object({
  userId: z.number().int().positive('请选择用户'),
  plan: z.string().min(1, '请输入套餐名称'),
  amount: z.number().positive('金额必须大于0'),
});
