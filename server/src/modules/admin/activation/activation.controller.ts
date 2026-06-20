import { FastifyReply, FastifyRequest } from 'fastify';
import { adminActivationService } from './activation.service';
import { success, successMessage, paginated } from '../../../utils/response';
import { generateCsvFileName } from '../../../utils/csv';

/**
 * 管理员 - 激活码管理控制器
 */

/** 批量生成激活码 */
export async function generateCodesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const adminId = request.user.id;
    const { count, prefix = 'WB' } = request.body as { count: number; prefix?: string };
    const codes = await adminActivationService.generateCodes(count, prefix, adminId);
    success(reply, { codes }, '生成成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 激活码列表 */
export async function listCodesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as {
      status?: string;
      page?: string;
      pageSize?: string;
    };

    const filters: any = {};
    if (query.status) filters.status = query.status;

    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const result = await adminActivationService.listCodes(filters, page, pageSize);
    paginated(reply, result.list, result.total, result.page, result.pageSize);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 禁用激活码 */
export async function disableCodeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    await adminActivationService.disableCode(parseInt(id, 10));
    successMessage(reply, '禁用成功');
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}

/** 导出 CSV */
export async function exportCodesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = request.query as { status?: string };
    const filters: any = {};
    if (query.status) filters.status = query.status;

    const csv = await adminActivationService.exportCodes(filters);
    const fileName = generateCsvFileName('activation_codes');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send('\ufeff' + csv); 
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
