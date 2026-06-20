import { FastifyReply, FastifyRequest } from 'fastify';
import { alarmService } from './alarm.service';
import { paginated, success } from '../../utils/response';

/**
 * 告警模块控制器
 */

/** 告警日志列表 */
export async function listAlarmsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const query = request.query as {
      deviceId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      pageSize?: string;
    };

    const filters: any = {};
    if (query.deviceId) filters.deviceId = parseInt(query.deviceId, 10);
    if (query.type) filters.type = query.type as any;
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);

    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const result = await alarmService.listAlarms(userId, filters, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 告警统计 */
export async function alarmStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const userId = request.user.id;
    const { days = '7' } = request.query as { days?: string };
    const stats = await alarmService.getAlarmStats(userId, parseInt(days, 10));
    success(reply, { stats }, '获取成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
