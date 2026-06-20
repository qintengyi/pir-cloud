/**
 * Fastify 类型增强声明
 * 为 FastifyRequest 添加 user 属性
 */
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: import('../types').AuthUser;
  }
}
