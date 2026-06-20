import { describe, it, expect } from 'vitest';
import {
  generateActivationCode,
  generateActivationCodes,
  generateDeviceToken,
  generateVerificationCode,
  generateOrderNo,
} from '../src/utils/crypto';

describe('Crypto Utilities', () => {
  describe('generateActivationCode', () => {
    it('should generate a code with WB- prefix by default', () => {
      const code = generateActivationCode();
      expect(code).toMatch(/^WB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should support custom prefix', () => {
      const code = generateActivationCode('TEST');
      expect(code).toMatch(/^TEST-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate unique codes on repeated calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateActivationCode());
      }
      // With 36^12 possible combinations, collisions are extremely unlikely
      expect(codes.size).toBe(100);
    });

    it('should only contain uppercase letters and digits in the body', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateActivationCode();
        const body = code.replace(/^WB-/, '').replace(/-/g, '');
        expect(body).toMatch(/^[A-Z0-9]+$/);
        expect(body).toHaveLength(12);
      }
    });
  });

  describe('generateActivationCodes (batch)', () => {
    it('should generate the requested number of codes', () => {
      const codes = generateActivationCodes(10);
      expect(codes).toHaveLength(10);
    });

    it('should generate unique codes', () => {
      const codes = generateActivationCodes(50);
      const set = new Set(codes);
      expect(set.size).toBe(50);
    });

    it('should avoid existing codes', () => {
      const existing = new Set([generateActivationCode()]);
      const codes = generateActivationCodes(5, 'WB', existing);
      for (const code of codes) {
        expect(existing.has(code)).toBe(false);
      }
    });

    it('should handle count = 0', () => {
      const codes = generateActivationCodes(0);
      expect(codes).toHaveLength(0);
    });
  });

  describe('generateDeviceToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateDeviceToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateDeviceToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateVerificationCode', () => {
    it('should generate a 6-digit string', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should generate codes between 100000 and 999999', () => {
      for (let i = 0; i < 1000; i++) {
        const code = generateVerificationCode();
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('generateOrderNo', () => {
    it('should start with WB prefix', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(/^WB\d+$/);
    });

    it('should contain 14-digit timestamp portion', () => {
      const orderNo = generateOrderNo();
      // WB + YYYYMMDDHHmmss (14 digits) + 6-8 digit random = WB + 20-22 digits
      expect(orderNo).toMatch(/^WB\d{20,22}$/);
    });

    it('should generate unique order numbers', () => {
      const orderNos = new Set<string>();
      for (let i = 0; i < 100; i++) {
        orderNos.add(generateOrderNo());
      }
      // Some may collide if generated in the same second with same random,
      // but with 6-digit random, collisions are very unlikely
      expect(orderNos.size).toBeGreaterThan(90);
    });
  });
});
