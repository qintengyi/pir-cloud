import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../src/utils/jwt';

describe('JWT Utilities', () => {
  const testPayload = {
    userId: 42,
    email: 'test@test.local',
    role: 'user' as const,
  };

  const testRefreshPayload = {
    userId: 42,
    token: '',
  };

  describe('signAccessToken & verifyAccessToken', () => {
    it('should sign and verify an access token successfully', () => {
      const token = signAccessToken(testPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(42);
      expect(decoded!.email).toBe('test@test.local');
      expect(decoded!.role).toBe('user');
      expect(decoded!.type).toBe('access');
    });

    it('should return null for an invalid token', () => {
      const decoded = verifyAccessToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    it('should return null for a token signed with a different secret (refresh token)', () => {
      const refreshToken = signRefreshToken(testRefreshPayload);
      // refresh token should not verify as access token
      const decoded = verifyAccessToken(refreshToken);
      expect(decoded).toBeNull();
    });

    it('should handle different user roles (admin)', () => {
      const adminToken = signAccessToken({ userId: 1, email: 'admin@test.local', role: 'admin' });
      const decoded = verifyAccessToken(adminToken);
      expect(decoded).not.toBeNull();
      expect(decoded!.role).toBe('admin');
    });
  });

  describe('signRefreshToken & verifyRefreshToken', () => {
    it('should sign and verify a refresh token successfully', () => {
      const token = signRefreshToken(testRefreshPayload);
      expect(token).toBeTruthy();

      const decoded = verifyRefreshToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(42);
      expect(decoded!.type).toBe('refresh');
    });

    it('should return null for an invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid.refresh.token');
      expect(decoded).toBeNull();
    });

    it('should return null for an access token used as refresh token', () => {
      const accessToken = signAccessToken(testPayload);
      const decoded = verifyRefreshToken(accessToken);
      expect(decoded).toBeNull();
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a future date', () => {
      const expiry = getRefreshTokenExpiry();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return approximately 7 days from now (default config)', () => {
      const expiry = getRefreshTokenExpiry();
      const expectedMs = 7 * 24 * 60 * 60 * 1000;
      const actualMs = expiry.getTime() - Date.now();
      // Allow 5 second tolerance
      expect(actualMs).toBeGreaterThan(expectedMs - 5000);
      expect(actualMs).toBeLessThan(expectedMs + 5000);
    });
  });

  describe('Token type separation', () => {
    it('access token and refresh token should not be interchangeable', () => {
      const accessToken = signAccessToken(testPayload);
      const refreshToken = signRefreshToken(testRefreshPayload);

      expect(verifyAccessToken(refreshToken)).toBeNull();
      expect(verifyRefreshToken(accessToken)).toBeNull();
    });

    it('should produce different token strings for access vs refresh', () => {
      const accessToken = signAccessToken(testPayload);
      const refreshToken = signRefreshToken(testRefreshPayload);
      expect(accessToken).not.toBe(refreshToken);
    });
  });
});
