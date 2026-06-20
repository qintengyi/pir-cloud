/**
 * 管理员-系统配置 JSON Schema 定义
 */

/** 更新 SMTP 配置 */
export const updateSmtpSchema = {
  body: {
    type: 'object',
    required: ['host', 'port', 'username', 'password', 'from'],
    properties: {
      host: { type: 'string', minLength: 1, maxLength: 255 },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
      username: { type: 'string', minLength: 1, maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 255 },
      from: { type: 'string', minLength: 1, maxLength: 255 },
      secure: { type: 'boolean' },
    },
  },
};

/** 更新 OneBot 配置 */
export const updateOneBotSchema = {
  body: {
    type: 'object',
    required: ['wsUrl'],
    properties: {
      wsUrl: { type: 'string', minLength: 1, maxLength: 500 },
      token: { type: 'string', maxLength: 500 },
    },
  },
};

/** 测试 SMTP 发送 */
export const testSmtpSchema = {
  body: {
    type: 'object',
    required: ['to'],
    properties: {
      to: { type: 'string', format: 'email', maxLength: 255 },
    },
  },
};
