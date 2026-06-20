import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config/index';
import { generateOrderNo } from '../../utils/crypto';

/**
 * Payment service
 * Integrates with Epay (rainbow epay) for membership purchase.
 */

/**
 * Build the string to be signed: sorted query params (excluding sign/sign_type), empty values skipped.
 */
function buildSignString(params: Record<string, string | number | undefined>): string {
  const filtered: Array<[string, string]> = [];
  for (const key of Object.keys(params)) {
    if (key === 'sign' || key === 'sign_type') continue;
    const val = params[key];
    if (val === undefined || val === null || val === '') continue;
    filtered.push([key, String(val)]);
  }
  filtered.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return filtered.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Epay signature: MD5(signString + key), lowercase hex.
 */
function epaySign(params: Record<string, string | number | undefined>): string {
  const signStr = buildSignString(params);
  return crypto.createHash('md5').update(signStr + config.epay.key, 'utf8').digest('hex');
}

/**
 * Build payment URL using submit.php form redirect.
 */
function buildPaymentUrl(params: Record<string, string | number | undefined>): string {
  const sign = epaySign(params);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    query.append(k, String(v));
  }
  query.append('sign', sign);
  query.append('sign_type', 'MD5');
  return `${config.epay.apiUrl}/submit.php?${query.toString()}`;
}

/**
 * Verify epay notify signature.
 */
function verifyNotifySign(params: Record<string, string>): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const expected = epaySign(params);
  return sign === expected;
}

export class PaymentService {
  /**
   * Create a membership purchase order, return payment URL.
   */
  async createMembershipOrder(
    userId: number,
    payType: 'wxpay' | 'alipay',
    clientOrigin: string,
  ): Promise<{ orderNo: string; payUrl: string }> {
    const amount = config.epay.membershipPrice;
    const orderNo = generateOrderNo();
    const plan = 'permanent_membership';

    await prisma.order.create({
      data: {
        order_no: orderNo,
        user_id: userId,
        plan,
        amount,
        status: 'pending',
      },
    });

    logger.info({ userId, orderNo, payType, amount }, 'Membership order created');

    const serverOrigin = process.env.SERVER_PUBLIC_URL || clientOrigin;

    const params: Record<string, string | number | undefined> = {
      pid: config.epay.pid,
      type: payType,
      out_trade_no: orderNo,
      notify_url: `${serverOrigin}/api/payment/notify`,
      return_url: `${serverOrigin}/profile?pay=success`,
      name: plan,
      money: amount.toFixed(2),
    };

    const payUrl = buildPaymentUrl(params);
    return { orderNo, payUrl };
  }

  /**
   * Handle epay async notify, activate membership.
   */
  async handleNotify(params: Record<string, string>): Promise<string> {

    if (!verifyNotifySign(params)) {
      logger.warn({ params }, 'Epay notify sign verify failed');
      return 'fail';
    }

    const orderNo = params.out_trade_no;
    const tradeStatus = params.trade_status;
    if (tradeStatus !== 'TRADE_SUCCESS') {
      logger.warn({ orderNo, tradeStatus }, 'Epay notify: trade not success');
      return 'fail';
    }

    const order = await prisma.order.findUnique({
      where: { order_no: orderNo },
    });

    if (!order) {
      logger.warn({ orderNo }, 'Epay notify: order not found');
      return 'fail';
    }

    if (order.status === 'paid') {
      logger.info({ orderNo }, 'Epay notify: order already paid, skip');
      return 'success';
    }

    const notifyAmount = parseFloat(params.money);
    if (Math.abs(notifyAmount - parseFloat(order.amount.toString())) > 0.01) {
      logger.warn({ orderNo, dbAmount: order.amount.toString(), notifyAmount }, 'Epay notify: amount mismatch');
      return 'fail';
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paid_at: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: order.user_id },
        data: {
          membership_level: 'premium',
          membership_expire_at: null, 
        },
      }),
    ]);

    logger.info({ orderNo, userId: order.user_id }, 'Membership activated (permanent)');
    return 'success';
  }

  /**
   * List current user orders.
   */
  async listMyOrders(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where: { user_id: userId } }),
    ]);

    const list = orders.map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      plan: o.plan,
      amount: parseFloat(o.amount.toString()),
      status: o.status,
      paidAt: o.paid_at?.toISOString() || null,
      createdAt: o.created_at.toISOString(),
    }));

    return { list, total, page, pageSize };
  }
}

export const paymentService = new PaymentService();
