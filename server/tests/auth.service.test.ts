import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    verificationCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock email service
vi.mock('../src/modules/notification/email.service', () => ({
  EmailService: {
    sendVerificationEmail: vi.fn(),
    sendAlarmEmail: vi.fn(),
    sendTestEmail: vi.fn(),
  },
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '../src/config/prisma';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailService } from '../src/modules/notification/email.service';

// Helper to create a mock user
function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    email: 'test@test.local',
    password: '$2a$10$mockhashedpassword',
    nickname: 'TestUser',
    role: 'user',
    membership_level: 'free',
    membership_expire_at: null,
    qq_number: null,
    login_fail_count: 0,
    locked_until: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  const mockedPrisma = prisma as any;
  const mockedEmailService = EmailService as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe('sendVerificationCode - 60s resend prevention', () => {
    it('should reject resend within 60 seconds', async () => {
      // Simulate a code sent 30 seconds ago
      const recentDate = new Date(Date.now() - 30 * 1000);
      mockedPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@test.local',
        code: '123456',
        created_at: recentDate,
      });

      await expect(
        service.sendVerificationCode('test@test.local', 'register'),
      ).rejects.toThrow('验证码发送过于频繁');

      // Verify error has correct code
      try {
        await service.sendVerificationCode('test@test.local', 'register');
      } catch (err: any) {
        expect(err.code).toBe(1006);
        expect(err.statusCode).toBe(429);
      }
    });

    it('should allow resend after 60 seconds', async () => {
      // No recent code found (older than 60s)
      mockedPrisma.verificationCode.findFirst.mockResolvedValue(null);
      mockedPrisma.verificationCode.create.mockResolvedValue({});
      mockedEmailService.sendVerificationEmail.mockResolvedValue({});

      await expect(
        service.sendVerificationCode('test@test.local', 'register'),
      ).resolves.not.toThrow();

      expect(mockedPrisma.verificationCode.create).toHaveBeenCalledOnce();
    });

    it('should set 5 minute expiry on the verification code', async () => {
      mockedPrisma.verificationCode.findFirst.mockResolvedValue(null);
      mockedPrisma.verificationCode.create.mockResolvedValue({});
      mockedEmailService.sendVerificationEmail.mockResolvedValue({});

      await service.sendVerificationCode('test@test.local', 'register');

      const createCall = mockedPrisma.verificationCode.create.mock.calls[0][0];
      const expiresAt = createCall.data.expires_at as Date;
      const expectedExpiry = Date.now() + 5 * 60 * 1000;
      // Allow 5 second tolerance
      expect(expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
      expect(expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
    });
  });

  describe('login - 5 failed attempts lock for 15 minutes', () => {
    it('should lock account after 5 failed attempts', async () => {
      const user = createMockUser({ login_fail_count: 4 });
      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedPrisma.user.update.mockResolvedValue({});

      // Mock bcrypt compare to return false (wrong password)
      // We need to mock the bcrypt module
      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'comparePassword').mockResolvedValue(false);

      await expect(
        service.login('test@test.local', 'wrongpassword'),
      ).rejects.toThrow();

      // Check that account was locked
      const updateCall = mockedPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.login_fail_count).toBe(0);
      expect(updateCall.data.locked_until).toBeDefined();

      // locked_until should be approximately 15 minutes from now
      const lockedUntil = updateCall.data.locked_until as Date;
      const expectedLock = Date.now() + 15 * 60 * 1000;
      expect(lockedUntil.getTime()).toBeGreaterThan(expectedLock - 5000);
      expect(lockedUntil.getTime()).toBeLessThan(expectedLock + 5000);
    });

    it('should reject login when account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
      const user = createMockUser({ locked_until: lockedUntil });
      mockedPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login('test@test.local', 'anypassword'),
      ).rejects.toThrow();

      try {
        await service.login('test@test.local', 'anypassword');
      } catch (err: any) {
        expect(err.code).toBe(1002);
        expect(err.statusCode).toBe(403);
      }
    });

    it('should increment fail count on wrong password (not yet at 5)', async () => {
      const user = createMockUser({ login_fail_count: 2 });
      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedPrisma.user.update.mockResolvedValue({});

      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'comparePassword').mockResolvedValue(false);

      await expect(
        service.login('test@test.local', 'wrongpassword'),
      ).rejects.toThrow('还剩 2 次尝试机会');

      const updateCall = mockedPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.login_fail_count).toBe(3);
      expect(updateCall.data.locked_until).toBeUndefined();
    });

    it('should reset fail count on successful login', async () => {
      const user = createMockUser({ login_fail_count: 3 });
      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedPrisma.user.update.mockResolvedValue({});
      mockedPrisma.refreshToken.create.mockResolvedValue({});

      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'comparePassword').mockResolvedValue(true);

      const result = await service.login('test@test.local', 'correctpassword');

      const updateCall = mockedPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.login_fail_count).toBe(0);
      expect(updateCall.data.locked_until).toBeNull();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@test.local');
    });

    it('should reject login for non-existent user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@test.local', 'password'),
      ).rejects.toThrow();

      try {
        await service.login('nonexistent@test.local', 'password');
      } catch (err: any) {
        expect(err.code).toBe(1001);
        expect(err.statusCode).toBe(401);
      }
    });
  });

  describe('resetPassword - old token invalidation', () => {
    it('should delete all refresh tokens after password reset', async () => {
      const user = createMockUser();
      mockedPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@test.local',
        code: '123456',
        type: 'reset_password',
        used: false,
        expires_at: new Date(Date.now() + 3 * 60 * 1000),
      });
      mockedPrisma.verificationCode.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});
      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'hashPassword').mockResolvedValue('newhash');
      vi.spyOn(bcryptModule, 'validatePasswordStrength').mockReturnValue(true);

      await service.resetPassword('test@test.local', '123456', 'NewPass123');

      // Verify password was updated
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@test.local' },
          data: { password: 'newhash' },
        }),
      );

      // Verify all refresh tokens were deleted
      expect(mockedPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { user_id: user.id },
      });
    });
  });

  describe('refreshToken - token rotation', () => {
    it('should delete old token and generate new one on refresh', async () => {
      const oldToken = 'old-refresh-token-string';
      const user = createMockUser();

      // Mock verifyRefreshToken to return a valid payload for our test token
      const jwtModule = await import('../src/utils/jwt');
      vi.spyOn(jwtModule, 'verifyRefreshToken').mockReturnValue({
        userId: 1,
        token: '',
        type: 'refresh',
      });

      mockedPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 10,
        user_id: 1,
        token: oldToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        created_at: new Date(),
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.local',
        role: 'user',
      });
      mockedPrisma.refreshToken.delete.mockResolvedValue({});
      mockedPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken(oldToken);

      // Old token should be deleted
      expect(mockedPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });

      // New token should be created
      expect(mockedPrisma.refreshToken.create).toHaveBeenCalledOnce();

      // Should return new tokens
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject refresh with token not in database', async () => {
      const jwtModule = await import('../src/utils/jwt');
      // We need to mock verifyRefreshToken to return a valid payload
      vi.spyOn(jwtModule, 'verifyRefreshToken').mockReturnValue({
        userId: 1,
        token: '',
        type: 'refresh',
      });

      mockedPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshToken('some-token'),
      ).rejects.toThrow();

      try {
        await service.refreshToken('some-token');
      } catch (err: any) {
        expect(err.code).toBe(3004);
        expect(err.statusCode).toBe(401);
      }
    });

    it('should reject refresh with expired token', async () => {
      const jwtModule = await import('../src/utils/jwt');
      vi.spyOn(jwtModule, 'verifyRefreshToken').mockReturnValue({
        userId: 1,
        token: '',
        type: 'refresh',
      });

      mockedPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 10,
        user_id: 1,
        token: 'expired-token',
        expires_at: new Date(Date.now() - 60 * 1000), // expired 1 min ago
        created_at: new Date(),
      });
      mockedPrisma.refreshToken.delete.mockResolvedValue({});

      await expect(
        service.refreshToken('expired-token'),
      ).rejects.toThrow();

      try {
        await service.refreshToken('expired-token');
      } catch (err: any) {
        expect(err.code).toBe(3003);
      }
    });
  });

  describe('register - flow validation', () => {
    it('should reject weak password', async () => {
      await expect(
        service.register('new@test.local', '123456', 'weak'),
      ).rejects.toThrow('密码强度不足');
    });

    it('should reject if email already registered', async () => {
      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'validatePasswordStrength').mockReturnValue(true);

      mockedPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 1,
        email: 'existing@test.local',
        code: '123456',
        type: 'register',
        used: false,
        expires_at: new Date(Date.now() + 3 * 60 * 1000),
      });
      mockedPrisma.verificationCode.update.mockResolvedValue({});
      mockedPrisma.user.findUnique.mockResolvedValue(createMockUser());

      await expect(
        service.register('existing@test.local', '123456', 'StrongPass1'),
      ).rejects.toThrow('邮箱已注册');
    });

    it('should reject with wrong verification code', async () => {
      const bcryptModule = await import('../src/utils/bcrypt');
      vi.spyOn(bcryptModule, 'validatePasswordStrength').mockReturnValue(true);

      mockedPrisma.verificationCode.findFirst.mockResolvedValue(null);

      await expect(
        service.register('new@test.local', 'wrong', 'StrongPass1'),
      ).rejects.toThrow('验证码错误');
    });
  });
});
