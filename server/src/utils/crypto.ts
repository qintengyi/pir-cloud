import crypto from 'crypto';
import { config } from '../config/index';

/**
 * 加密工具模块
 * 负责生成激活码和设备 token
 */

/**
 * 生成激活码
 * 格式：大写字母+数字组合，长度16位，带连字符分组（如 WB-XXXX-XXXX-XXXX）
 * @param prefix 激活码前缀（默认 WB）
 * @returns 激活码字符串
 */
export function generateActivationCode(prefix: string = 'WB'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
  }
  
  const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  return `${prefix}-${formatted}`;
}

/**
 * 批量生成激活码（确保唯一性）
 * @param count 生成数量
 * @param prefix 激活码前缀
 * @param existingCodes 已存在的激活码集合（用于去重）
 * @returns 激活码数组
 */
export function generateActivationCodes(
  count: number,
  prefix: string = 'WB',
  existingCodes: Set<string> = new Set(),
): string[] {
  const codes: string[] = [];
  const generated = new Set<string>(existingCodes);

  while (codes.length < count) {
    const code = generateActivationCode(prefix);
    if (!generated.has(code)) {
      generated.add(code);
      codes.push(code);
    }
  }

  return codes;
}

/**
 * 生成设备 token
 * 使用 crypto.randomBytes 生成 hex 编码的随机字符串
 * @returns 设备 token（64 字符 hex 字符串）
 */
export function generateDeviceToken(): string {
  const tokenLength = config.deviceTokenLength; 
  return crypto.randomBytes(tokenLength).toString('hex');
}

/**
 * 生成验证码（6位数字）
 * @returns 6 位数字验证码字符串
 */
export function generateVerificationCode(): string {
  
  const min = 100000;
  const max = 999999;
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const code = min + (randomNum % (max - min + 1));
  return code.toString();
}

/**
 * 生成订单号
 * 格式：WB + 年月日时分秒 + 6位随机数
 * @returns 订单号字符串
 */
export function generateOrderNo(): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const randomNum = crypto.randomBytes(3).readUIntBE(0, 3);
  return `WB${dateStr}${String(randomNum).padStart(6, '0')}`;
}
