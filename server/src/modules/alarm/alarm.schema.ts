/**
 * 告警模块 JSON Schema 定义
 */

/** 告警日志列表查询 */
export const listAlarmsSchema = {
  querystring: {
    type: 'object',
    properties: {
      deviceId: { type: 'integer' },
      type: { type: 'string', enum: ['online', 'offline', 'alarm'] },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/** 告警统计查询 */
export const alarmStatsSchema = {
  querystring: {
    type: 'object',
    properties: {
      days: { type: 'integer', minimum: 1, maximum: 90, default: 7 },
    },
  },
};
