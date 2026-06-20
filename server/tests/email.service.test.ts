import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    systemConfig: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: vi.fn(),
  })),
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
import nodemailer from 'nodemailer';
import { EmailService } from '../src/modules/notification/email.service';

describe('EmailService - retry mechanism', () => {
  const mockedPrisma = prisma as any;

  const smtpConfig = {
    host: 'smtp.test.com',
    port: 465,
    username: 'user@test.com',
    password: 'pass',
    from: 'noreply@test.local',
    secure: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the EmailService transporter cache
    EmailService.clearCache();
  });

  function setupTransporter(sendMailFn: ReturnType<typeof vi.fn>) {
    mockedPrisma.systemConfig.findUnique.mockResolvedValue({
      config_key: 'smtp',
      config_value: smtpConfig,
    });
    (nodemailer.createTransport as any).mockReturnValue({
      sendMail: sendMailFn,
    });
  }

  it('should succeed on first attempt', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-msg-id' });
    setupTransporter(sendMail);

    await EmailService.sendTestEmail('user@test.local');

    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('should retry 3 times with exponential backoff on failure', async () => {
    const sendMail = vi.fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    setupTransporter(sendMail);

    // Mock setTimeout to speed up tests
    const originalSetTimeout = global.setTimeout;
    vi.useFakeTimers();

    const sendPromise = EmailService.sendTestEmail('user@test.local');

    // Fast-forward through the delays (1s, 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await sendPromise;

    vi.useRealTimers();

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('should succeed on third retry attempt', async () => {
    const sendMail = vi.fn()
      .mockRejectedValueOnce(new Error('Temp error'))
      .mockRejectedValueOnce(new Error('Temp error'))
      .mockResolvedValueOnce({ messageId: 'success-id' });

    setupTransporter(sendMail);

    vi.useFakeTimers();

    const sendPromise = EmailService.sendTestEmail('user@test.local');

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await sendPromise;

    vi.useRealTimers();

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });

  it('should return failure when SMTP config is not set', async () => {
    mockedPrisma.systemConfig.findUnique.mockResolvedValue(null);

    const result = await EmailService.sendTestEmail('user@test.local');
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMTP');
  });

  it('should return failure when required SMTP fields are missing', async () => {
    mockedPrisma.systemConfig.findUnique.mockResolvedValue({
      config_key: 'smtp',
      config_value: { host: '', username: '', from: '' },
    });

    const result = await EmailService.sendTestEmail('user@test.local');
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMTP');
  });
});
