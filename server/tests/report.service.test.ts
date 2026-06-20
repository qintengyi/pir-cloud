import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    device: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    deviceConfig: {
      findUnique: vi.fn(),
    },
    activationCode: {
      findUnique: vi.fn(),
    },
    event: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock debounce service
vi.mock('../src/modules/notification/debounce.service', () => ({
  DebounceService: {
    shouldTrigger: vi.fn(),
  },
}));

// Mock notification service
vi.mock('../src/modules/notification/notification.service', () => ({
  NotificationService: {
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../src/config/prisma';
import { DebounceService } from '../src/modules/notification/debounce.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { ReportService } from '../src/modules/report/report.service';

describe('ReportService', () => {
  let service: ReportService;
  const mockedPrisma = prisma as any;
  const mockedDebounce = DebounceService as any;
  const mockedNotification = NotificationService as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService();
  });

  describe('handleReport - device authentication', () => {
    it('should authenticate with device_token (priority)', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});

      const result = await service.handleReport('valid-token', undefined, {
        status: 'absence',
      });

      expect(result.message).toBe('上报成功');
      // Should have looked up by device_token
      const callArgs = mockedPrisma.device.findUnique.mock.calls[0][0];
      expect(callArgs.where.device_token).toBe('valid-token');
    });

    it('should fallback to activation_code when no device_token', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.activationCode.findUnique.mockResolvedValue({
        id: 1,
        status: 'bound',
        device: mockDevice,
      });
      mockedPrisma.device.update.mockResolvedValue({});

      const result = await service.handleReport(undefined, 'WB-ABCD-EFGH-IJKL', {
        status: 'absence',
      });

      expect(result.message).toBe('上报成功');
      const callArgs = mockedPrisma.activationCode.findUnique.mock.calls[0][0];
      expect(callArgs.where.code).toBe('WB-ABCD-EFGH-IJKL');
    });

    it('should reject when neither device_token nor activation_code provided', async () => {
      await expect(
        service.handleReport(undefined, undefined, { status: 'absence' }),
      ).rejects.toThrow('设备未授权');

      try {
        await service.handleReport(undefined, undefined, { status: 'absence' });
      } catch (err: any) {
        expect(err.code).toBe(2005);
        expect(err.statusCode).toBe(401);
      }
    });

    it('should reject when activation_code is not bound', async () => {
      mockedPrisma.activationCode.findUnique.mockResolvedValue({
        id: 1,
        status: 'unused',
        device: null,
      });

      await expect(
        service.handleReport(undefined, 'WB-XXXX-YYYY-ZZZZ', { status: 'absence' }),
      ).rejects.toThrow('设备未授权');
    });

    it('should reject when activation_code is disabled', async () => {
      mockedPrisma.activationCode.findUnique.mockResolvedValue({
        id: 1,
        status: 'disabled',
        device: null,
      });

      await expect(
        service.handleReport(undefined, 'WB-XXXX-YYYY-ZZZZ', { status: 'absence' }),
      ).rejects.toThrow('设备未授权');
    });

    it('should reject when device_token does not match any device', async () => {
      mockedPrisma.device.findUnique.mockResolvedValue(null);

      await expect(
        service.handleReport('invalid-token', undefined, { status: 'absence' }),
      ).rejects.toThrow('设备未授权');
    });
  });

  describe('handleReport - status handling', () => {
    it('should NOT trigger alarm for absence status', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});

      const result = await service.handleReport('valid-token', undefined, {
        status: 'absence',
      });

      expect(result.message).toBe('上报成功');
      // Should NOT have queried device config or debounce
      expect(mockedPrisma.deviceConfig.findUnique).not.toHaveBeenCalled();
      expect(mockedDebounce.shouldTrigger).not.toHaveBeenCalled();
      expect(mockedPrisma.event.create).not.toHaveBeenCalled();
    });

    it('should trigger alarm for presence status (passes debounce)', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        debounce_interval: 30,
        notify_enabled: true,
        notify_channels: ['email'],
      });
      mockedDebounce.shouldTrigger.mockResolvedValue(true);
      mockedPrisma.event.create.mockResolvedValue({
        id: 100,
        type: 'alarm',
        detail: { message: '人体检测告警' },
        created_at: new Date(),
      });

      const result = await service.handleReport('valid-token', undefined, {
        status: 'presence',
      });

      expect(result.message).toBe('上报成功');
      // Should have created an alarm event
      expect(mockedPrisma.event.create).toHaveBeenCalledOnce();
      const createCall = mockedPrisma.event.create.mock.calls[0][0];
      expect(createCall.data.type).toBe('alarm');
      expect(createCall.data.device_id).toBe(1);
      expect(createCall.data.user_id).toBe(10);
    });

    it('should NOT create alarm when debounced (within window)', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        debounce_interval: 30,
      });
      mockedDebounce.shouldTrigger.mockResolvedValue(false); // debounced

      const result = await service.handleReport('valid-token', undefined, {
        status: 'presence',
      });

      expect(result.message).toBe('上报成功');
      // Should NOT have created an event
      expect(mockedPrisma.event.create).not.toHaveBeenCalled();
    });

    it('should use default debounce interval of 30s when config is missing', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue(null);
      mockedDebounce.shouldTrigger.mockResolvedValue(true);
      mockedPrisma.event.create.mockResolvedValue({
        id: 100,
        type: 'alarm',
        detail: {},
        created_at: new Date(),
      });

      await service.handleReport('valid-token', undefined, {
        status: 'presence',
      });

      // Should have called debounce with interval 30 (default)
      expect(mockedDebounce.shouldTrigger).toHaveBeenCalledWith(1, 30);
    });
  });

  describe('handleReport - async notification', () => {
    it('should dispatch notification asynchronously via setImmediate', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});
      mockedPrisma.deviceConfig.findUnique.mockResolvedValue({
        debounce_interval: 30,
      });
      mockedDebounce.shouldTrigger.mockResolvedValue(true);
      mockedPrisma.event.create.mockResolvedValue({
        id: 100,
        type: 'alarm',
        detail: { message: '人体检测告警' },
        created_at: new Date(),
      });

      // Spy on setImmediate
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');

      await service.handleReport('valid-token', undefined, {
        status: 'presence',
      });

      // setImmediate should have been called (async notification)
      expect(setImmediateSpy).toHaveBeenCalledOnce();

      // The notification dispatch should be scheduled but not yet called synchronously
      expect(mockedNotification.dispatch).not.toHaveBeenCalled();

      // Restore spy
      setImmediateSpy.mockRestore();
    });
  });

  describe('handleHeartbeat', () => {
    it('should reject when no device_token provided', async () => {
      await expect(service.handleHeartbeat(undefined)).rejects.toThrow('设备未授权');
    });

    it('should update device heartbeat on valid token', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'Device1' };
      mockedPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue({});

      await service.handleHeartbeat('valid-token');

      expect(mockedPrisma.device.update).toHaveBeenCalledOnce();
      const updateCall = mockedPrisma.device.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('online');
      expect(updateCall.data.last_heartbeat_at).toBeDefined();
    });

    it('should reject when device_token is invalid', async () => {
      mockedPrisma.device.findUnique.mockResolvedValue(null);

      await expect(service.handleHeartbeat('invalid-token')).rejects.toThrow('设备未授权');
    });
  });
});
