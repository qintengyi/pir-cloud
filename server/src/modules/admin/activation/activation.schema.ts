/**
 * 激活码管理 JSON Schema 定义
 */

/** 批量生成激活码 */
export const generateCodesSchema = {
  body: {
    type: 'object',
    required: ['count'],
    properties: {
      count: { type: 'integer', minimum: 1, maximum: 500 },
      prefix: { type: 'string', minLength: 1, maxLength: 10 },
    },
  },
};

/** 激活码列表查询 */
export const listCodesSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['unused', 'bound', 'disabled'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/** 激活码导出查询 */
export const exportCodesSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['unused', 'bound', 'disabled'] },
    },
  },
};
