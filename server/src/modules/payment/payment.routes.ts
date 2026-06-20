import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  createPaymentHandler,
  notifyHandler,
  myOrdersHandler,
} from './payment.controller';

/**
 * Payment routes
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        const params: Record<string, string> = {};
        const search = new URLSearchParams(body.toString());
        search.forEach((v, k) => {
          params[k] = v;
        });
        done(null, params);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post('/api/payment/create', {
    preHandler: [authMiddleware],
    handler: createPaymentHandler,
  });

  app.post('/api/payment/notify', {
    handler: notifyHandler,
  });

  app.get('/api/payment/notify', {
    handler: notifyHandler,
  });

  app.get('/api/payment/orders', {
    preHandler: [authMiddleware],
    handler: myOrdersHandler,
  });
}
