/**
 * 设备模块 JSON Schema 定义
 */

/** 重命名设备 */
export const renameDeviceSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
    },
  },
};

/** 绑定设备（激活码） */
export const bindDeviceSchema = {
  body: {
    type: 'object',
    required: ['activationCode'],
    properties: {
      activationCode: { type: 'string', minLength: 1, maxLength: 32 },
    },
  },
};

/** 修改设备配置 */
export const updateDeviceConfigSchema = {
  body: {
    type: 'object',
    properties: {
      notifyEnabled: { type: 'boolean' },
      debounceInterval: { type: 'integer', minimum: 5, maximum: 3600 },
      notifyChannels: {
        type: 'array',
        items: { type: 'string', enum: ['email', 'qq_bot'] },
        maxItems: 2,
      },
      onlineRemindEnabled: { type: 'boolean' },
      onlineRemindIntervalMinutes: { type: 'integer', minimum: 1, maximum: 10080 },
    },
    additionalProperties: false,
  },
};

/** 设备列表查询参数 */
export const listDevicesSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/** 设备直连激活（激活码换 device_token）
 *  设备端无 JWT，通过 X-Activation-Code 请求头鉴权（body 字段作为 fallback）
 *  activationCode 非必填——header 已携带时 body 可为空
 */
export const activateDeviceSchema = {
  body: {
    type: 'object',
    properties: {
      activationCode: { type: 'string', minLength: 1, maxLength: 32 },
    },
    additionalProperties: false,
  },
};
