import type { FastifyReply } from 'fastify';

/**
 * 统一 API 响应格式
 * { code: number, message: string, data: T }
 */

/**
 * 成功响应
 * @param reply FastifyReply 实例
 * @param data 业务数据
 * @param message 提示信息
 * @param statusCode HTTP 状态码
 */
export function success<T>(
  reply: FastifyReply,
  data: T,
  message: string = '操作成功',
  statusCode: number = 200,
): FastifyReply {
  return reply.status(statusCode).send({
    code: 0,
    message,
    data,
  });
}

/**
 * 成功响应（仅消息，无数据）
 * @param reply FastifyReply 实例
 * @param message 提示信息
 * @param statusCode HTTP 状态码
 */
export function successMessage(
  reply: FastifyReply,
  message: string = '操作成功',
  statusCode: number = 200,
): FastifyReply {
  return reply.status(statusCode).send({
    code: 0,
    message,
    data: null,
  });
}

/**
 * 分页成功响应
 * @param reply FastifyReply 实例
 * @param list 数据列表
 * @param total 总数
 * @param page 当前页
 * @param pageSize 每页条数
 * @param message 提示信息
 */
export function paginated<T>(
  reply: FastifyReply,
  list: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = '查询成功',
): FastifyReply {
  return reply.status(200).send({
    code: 0,
    message,
    data: {
      list,
      total,
      page,
      pageSize,
    },
  });
}

/**
 * 错误响应
 * @param reply FastifyReply 实例
 * @param code 业务错误码（非0）
 * @param message 错误提示
 * @param statusCode HTTP 状态码
 */
export function error(
  reply: FastifyReply,
  code: number,
  message: string,
  statusCode: number,
): FastifyReply {
  return reply.status(statusCode).send({
    code,
    message,
    data: null,
  });
}

/**
 * 错误码常量枚举
 */
export const ErrorCode = {
  
  EMAIL_OR_PASSWORD_ERROR: { code: 1001, statusCode: 401, message: '邮箱或密码错误' },
  ACCOUNT_LOCKED: { code: 1002, statusCode: 403, message: '账号已锁定，请稍后再试' },
  EMAIL_ALREADY_REGISTERED: { code: 1003, statusCode: 409, message: '邮箱已注册' },
  VERIFICATION_CODE_ERROR: { code: 1004, statusCode: 400, message: '验证码错误' },
  VERIFICATION_CODE_EXPIRED: { code: 1005, statusCode: 400, message: '验证码已过期' },
  VERIFICATION_CODE_TOO_FREQUENT: { code: 1006, statusCode: 429, message: '验证码发送过于频繁，请60秒后再试' },
  PASSWORD_TOO_WEAK: { code: 1007, statusCode: 400, message: '密码强度不足，需至少8位含字母和数字' },
  OLD_PASSWORD_ERROR: { code: 1008, statusCode: 400, message: '旧密码错误' },

  ACTIVATION_CODE_INVALID: { code: 2001, statusCode: 400, message: '激活码无效' },
  ACTIVATION_CODE_ALREADY_BOUND: { code: 2002, statusCode: 409, message: '激活码已被绑定' },
  ACTIVATION_CODE_DISABLED: { code: 2003, statusCode: 403, message: '激活码已禁用' },
  DEVICE_NOT_FOUND: { code: 2004, statusCode: 404, message: '设备不存在' },
  DEVICE_UNAUTHORIZED: { code: 2005, statusCode: 401, message: '设备未授权' },
  DEVICE_NOT_OWNED: { code: 2006, statusCode: 403, message: '设备不属于当前用户' },

  NOT_AUTHENTICATED: { code: 3001, statusCode: 401, message: '未登录或登录已过期' },
  NO_PERMISSION: { code: 3002, statusCode: 403, message: '无权限访问' },
  TOKEN_EXPIRED: { code: 3003, statusCode: 401, message: 'Token已过期' },
  TOKEN_INVALID: { code: 3004, statusCode: 401, message: 'Token无效' },

  PARAMS_VALIDATION_FAILED: { code: 4001, statusCode: 400, message: '参数校验失败' },
  RATE_LIMIT_EXCEEDED: { code: 4002, statusCode: 429, message: '请求频率超限，请稍后再试' },

  INTERNAL_ERROR: { code: 5001, statusCode: 500, message: '服务器内部错误' },
  EMAIL_SEND_FAILED: { code: 5002, statusCode: 500, message: '邮件发送失败' },
  ONEBOT_CONNECTION_FAILED: { code: 5003, statusCode: 500, message: 'OneBot连接失败' },
  DATABASE_ERROR: { code: 5004, statusCode: 500, message: '数据库错误' },
} as const;

/**
 * 使用错误码常量发送错误响应
 * @param reply FastifyReply 实例
 * @param errorCode 错误码常量
 * @param customMessage 自定义错误消息（可选）
 */
export function errorWithCode(
  reply: FastifyReply,
  errorCode: { code: number; statusCode: number; message: string },
  customMessage?: string,
): FastifyReply {
  return error(reply, errorCode.code, customMessage || errorCode.message, errorCode.statusCode);
}
