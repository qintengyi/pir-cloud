/**
 * 管理员-订单管理 JSON Schema 定义
 */

/** 订单列表查询 */
export const listOrdersSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'cancelled', 'refunded'] },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/** 手动创建订单 */
export const createOrderSchema = {
  body: {
    type: 'object',
    required: ['userId', 'plan', 'amount'],
    properties: {
      userId: { type: 'integer', minimum: 1 },
      plan: { type: 'string', minLength: 1, maxLength: 50 },
      amount: { type: 'number', minimum: 0 },
    },
  },
};

/** 订单导出查询 */
export const exportOrdersSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'cancelled', 'refunded'] },
    },
  },
};
