/**
 * 用户模块 JSON Schema 定义
 */

/** 修改昵称 */
export const updateProfileSchema = {
  body: {
    type: 'object',
    required: ['nickname'],
    properties: {
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
    },
  },
};

/** 修改密码 */
export const changePasswordSchema = {
  body: {
    type: 'object',
    required: ['oldPassword', 'newPassword'],
    properties: {
      oldPassword: { type: 'string', minLength: 1, maxLength: 64 },
      newPassword: { type: 'string', minLength: 8, maxLength: 64 },
    },
  },
};

/** 绑定 QQ 号 */
export const updateQQSchema = {
  body: {
    type: 'object',
    required: ['qqNumber'],
    properties: {
      qqNumber: { type: 'string', pattern: '^[0-9]{5,12}$' },
    },
  },
};
