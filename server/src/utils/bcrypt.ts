import bcrypt from 'bcryptjs';
import { config } from '../config/index';

/**
 * bcrypt 密码哈希工具
 */

/**
 * 哈希密码
 * @param password 明文密码
 * @returns 哈希后的密码字符串
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptSaltRounds);
}

/**
 * 比对密码
 * @param password 明文密码
 * @param hashedPassword 哈希后的密码
 * @returns 是否匹配
 */
export function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 验证密码强度
 * 要求：至少8位，包含字母和数字
 * @param password 明文密码
 * @returns 是否满足强度要求
 */
export function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) {
    return false;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}
