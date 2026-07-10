export const requestQqVerifySchema = {
  body: {
    type: 'object',
    required: ['qqNumber'],
    properties: {
      qqNumber: { type: 'string', minLength: 5, maxLength: 20 },
    },
  },
};

export const qqVerifyCallbackSchema = {
  body: {
    type: 'object',
    required: ['qqNumber', 'code'],
    properties: {
      qqNumber: { type: 'string', minLength: 5, maxLength: 20 },
      code: { type: 'string', minLength: 6, maxLength: 6 },
    },
  },
};
