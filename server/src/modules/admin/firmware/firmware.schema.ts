/**
 * 固件版本管理 JSON Schema 定义
 * 注意：上传接口是 multipart/form-data，其字段在 controller 中手动解析校验，
 * 这里只定义查询类 schema。
 */

/** 固件版本列表查询 */
export const listFirmwaresSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      deviceType: { type: 'string', enum: ['infrared', 'microwave'] },
    },
  },
};
