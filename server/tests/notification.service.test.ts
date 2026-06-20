import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    deviceConfig: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock email service
vi.mock('../src/modules/notification/email.service', () => ({
  EmailService: {
    sendAlarmEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    sendTestEmail: vi.fn(),
  },
}));

// Mock onebot service
vi.mock('../src/modules/notification/onebot.service', () => ({
  OneBotService: {
    sendMessage: vi.fn(),
    connect: vi.fn(),
    testConnection: vi.fn(),
    getConnectionStatus: vi.fn(),
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
import { EmailService } from '../src/modules/notification/email.service';
import { OneBotService } from '../src/modules/notification/onebot.service';
import { NotificationService } from '../src/modules/notification/notification.service';

describe('NotificationService', () => {
  const mockedPrisma = prisma as any;
  const mockedEmailService = EmailService as any;
  const mockedOneBotService = OneBotService as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDevice = { id: 1, name: 'Sensor-01', user_id: 10 };
  const mockEvent = {
    id: 100,
    type: 'alarm',
    detail: { message: '人体检测告警' },
    created_at: new Date(),
  };

  describe('dispatch - notification enabled/disabled', () => {
    it('should skip notification when notify_enabled is false', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: false,
        debounce_interval: 30,
        notify_channels: ['email'],
      });

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedEmailService.sendAlarmEmail).not.toHaveBeenCalled();
      expect(mockedOneBotService.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip notification when device config is not found', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue(null);

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedEmailService.sendAlarmEmail).not.toHaveBeenCalled();
    });

    it('should skip notification when user is not found', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['email'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedEmailService.sendAlarmEmail).not.toHaveBeenCalled();
    });
  });

  describe('dispatch - email channel', () => {
    it('should send email notification when email channel is enabled', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['email'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: null,
        membership_level: 'free',
        membership_expire_at: null,
      });
      mockedEmailService.sendAlarmEmail.mockResolvedValue({ success: true });

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedEmailService.sendAlarmEmail).toHaveBeenCalledWith(
        'user@test.local',
        'Sensor-01',
        mockEvent.created_at,
        '人体检测告警',
      );
    });
  });

  describe('dispatch - QQ bot channel with fallback', () => {
    it('should skip QQ for free users (non-premium)', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: '123456',
        membership_level: 'free',
        membership_expire_at: null,
      });

      await NotificationService.dispatch(mockDevice, mockEvent);

      // QQ should be skipped for free users
      expect(mockedOneBotService.sendMessage).not.toHaveBeenCalled();
      // No email fallback either since only qq_bot channel was configured
      expect(mockedEmailService.sendAlarmEmail).not.toHaveBeenCalled();
    });

    it('should skip QQ when user has no QQ number bound', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: null,
        membership_level: 'premium',
        membership_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedOneBotService.sendMessage).not.toHaveBeenCalled();
    });

    it('should fallback to email when QQ notification fails', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: '123456789',
        membership_level: 'premium',
        membership_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      mockedOneBotService.sendMessage.mockResolvedValue(false); // QQ fails
      mockedEmailService.sendAlarmEmail.mockResolvedValue({ success: true });

      await NotificationService.dispatch(mockDevice, mockEvent);

      // QQ should have been attempted
      expect(mockedOneBotService.sendMessage).toHaveBeenCalledOnce();
      // Email fallback should have been triggered
      expect(mockedEmailService.sendAlarmEmail).toHaveBeenCalledWith(
        'user@test.local',
        'Sensor-01',
        mockEvent.created_at,
        '人体检测告警',
      );
    });

    it('should NOT fallback to email when QQ succeeds', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: '123456789',
        membership_level: 'premium',
        membership_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      mockedOneBotService.sendMessage.mockResolvedValue(true); // QQ succeeds

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedOneBotService.sendMessage).toHaveBeenCalledOnce();
      expect(mockedEmailService.sendAlarmEmail).not.toHaveBeenCalled();
    });
  });

  describe('dispatch - multiple channels', () => {
    it('should send to both email and QQ when both channels configured', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['email', 'qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: '123456789',
        membership_level: 'premium',
        membership_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      mockedEmailService.sendAlarmEmail.mockResolvedValue({ success: true });
      mockedOneBotService.sendMessage.mockResolvedValue(true);

      await NotificationService.dispatch(mockDevice, mockEvent);

      expect(mockedEmailService.sendAlarmEmail).toHaveBeenCalledOnce();
      expect(mockedOneBotService.sendMessage).toHaveBeenCalledOnce();
    });
  });

  describe('dispatch - expired premium membership', () => {
    it('should treat expired premium as free user for QQ', async () => {
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        notify_enabled: true,
        debounce_interval: 30,
        notify_channels: ['qq_bot'],
      });
      mockedPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.local',
        qq_number: '123456789',
        membership_level: 'premium',
        membership_expire_at: new Date(Date.now() - 60 * 1000), // expired
      });

      await NotificationService.dispatch(mockDevice, mockEvent);

      // QQ should be skipped since premium expired
      expect(mockedOneBotService.sendMessage).not.toHaveBeenCalled();
    });
  });
});
