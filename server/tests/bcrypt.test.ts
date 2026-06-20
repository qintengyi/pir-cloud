import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} from '../src/utils/bcrypt';

describe('Bcrypt Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password and return a different string', async () => {
      const password = 'TestPass123';
      const hashed = await hashPassword(password);
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(20);
    });

    it('should generate different hashes for the same password (salt)', async () => {
      const password = 'SamePass456';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'CorrectPass789';
      const hashed = await hashPassword(password);
      const result = await comparePassword(password, hashed);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'CorrectPass789';
      const wrongPassword = 'WrongPass000';
      const hashed = await hashPassword(password);
      const result = await comparePassword(wrongPassword, hashed);
      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hashed = await hashPassword('SomePassword123');
      const result = await comparePassword('', hashed);
      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should return true for a strong password (8+ chars with letters and numbers)', () => {
      expect(validatePasswordStrength('Pass1234')).toBe(true);
      expect(validatePasswordStrength('Abcdef1x')).toBe(true);
      expect(validatePasswordStrength('MySecure2025')).toBe(true);
    });

    it('should return false for password shorter than 8 characters', () => {
      expect(validatePasswordStrength('Ab1')).toBe(false);
      expect(validatePasswordStrength('Pass12')).toBe(false);
      expect(validatePasswordStrength('Abcde1')).toBe(false);
      expect(validatePasswordStrength('')).toBe(false);
    });

    it('should return false for password without numbers', () => {
      expect(validatePasswordStrength('PasswordOnly')).toBe(false);
      expect(validatePasswordStrength('abcdefgh')).toBe(false);
    });

    it('should return false for password without letters', () => {
      expect(validatePasswordStrength('12345678')).toBe(false);
      expect(validatePasswordStrength('00000000')).toBe(false);
    });

    it('should return true for password with both upper and lowercase letters and numbers', () => {
      expect(validatePasswordStrength('ChangeMe123!')).toBe(true);
    });
  });
});
