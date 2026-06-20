/**
 * 管理员-用户管理 JSON Schema 定义
 */

/** 用户列表查询 */
export const listUsersSchema = {
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', maxLength: 100 },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/** 修改会员等级 */
export const updateMembershipSchema = {
  body: {
    type: 'object',
    required: ['level'],
    properties: {
      level: { type: 'string', enum: ['free', 'premium'] },
      expireAt: { type: 'string', format: 'date-time' },
    },
  },
};
