/**
 * 上报模块 JSON Schema 定义
 */

/** 数据上报 */
export const reportSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['presence', 'absence'] },
      timestamp: { type: 'integer' },
      rssi: { type: 'integer' },
      extra: { type: 'object' },
    },
  },
};

/** 心跳 */
export const heartbeatSchema = {
  body: {
    type: 'object',
    properties: {
      timestamp: { type: 'integer' },
      rssi: { type: 'integer' },
    },
  },
};
