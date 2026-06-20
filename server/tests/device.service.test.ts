import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    device: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    deviceConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    activationCode: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    event: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

import { prisma } from '../src/config/prisma';
import { DeviceService } from '../src/modules/device/device.service';

describe('DeviceService', () => {
  let service: DeviceService;
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService();
  });

  describe('bindDevice - activation code binding', () => {
    it('should reject non-existent activation code', async () => {
      mockedPrisma.activationCode.findUnique.mockResolvedValue(null);

      await expect(service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ')).rejects.toThrow('激活码无效');

      try {
        await service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ');
      } catch (err: any) {
        expect(err.code).toBe(2001);
        expect(err.statusCode).toBe(400);
      }
    });

    it('should reject disabled activation code', async () => {
      mockedPrisma.activationCode.findUnique.mockResolvedValue({
        id: 1,
        code: 'WB-XXXX-YYYY-ZZZZ',
        status: 'disabled',
      });

      await expect(service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ')).rejects.toThrow('激活码已禁用');

      try {
        await service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ');
      } catch (err: any) {
        expect(err.code).toBe(2003);
        expect(err.statusCode).toBe(403);
      }
    });

    it('should reject already-bound activation code', async () => {
      mockedPrisma.activationCode.findUnique.mockResolvedValue({
        id: 1,
        code: 'WB-XXXX-YYYY-ZZZZ',
        status: 'bound',
      });

      await expect(service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ')).rejects.toThrow('激活码已被绑定');

      try {
        await service.bindDevice(1, 'WB-XXXX-YYYY-ZZZZ');
      } catch (err: any) {
        expect(err.code).toBe(2002);
        expect(err.statusCode).toBe(409);
      }
    });

    it('should successfully bind an unused activation code via transaction', async () => {
      const mockActivationCode = {
        id: 1,
        code: 'WB-ABCD-EFGH-IJKL',
        status: 'unused',
      };
      const mockNewDevice = {
        id: 5,
        user_id: 10,
        name: '未命名设备',
        device_token: 'abc123token',
        status: 'offline',
        created_at: new Date(),
      };

      mockedPrisma.activationCode.findUnique.mockResolvedValue(mockActivationCode);
      mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
        // Mock the transaction client
        const tx = {
          device: {
            create: vi.fn().mockResolvedValue(mockNewDevice),
          },
          deviceConfig: {
            create: vi.fn().mockResolvedValue({}),
          },
          activationCode: {
            update: vi.fn().mockResolvedValue({}),
          },
          event: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.bindDevice(10, 'WB-ABCD-EFGH-IJKL');

      expect(result.id).toBe(5);
      expect(result.deviceToken).toBe('abc123token');
      expect(result.status).toBe('offline');

      // Verify transaction was called
      expect(mockedPrisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe('renameDevice', () => {
    it('should rename an existing device owned by the user', async () => {
      const mockDevice = { id: 1, user_id: 10, name: 'OldName' };
      const mockUpdated = { ...mockDevice, name: 'NewName', device_token: 'token', status: 'online', last_report_at: null, last_heartbeat_at: null, created_at: new Date() };

      mockedPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockedPrisma.device.update.mockResolvedValue(mockUpdated);

      const result = await service.renameDevice(10, 1, 'NewName');

      expect(result.name).toBe('NewName');
      expect(mockedPrisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { name: 'NewName' },
        }),
      );
    });

    it('should reject renaming a device not owned by the user', async () => {
      mockedPrisma.device.findFirst.mockResolvedValue(null);

      await expect(service.renameDevice(10, 999, 'NewName')).rejects.toThrow('设备不存在');
    });
  });

  describe('deleteDevice', () => {
    it('should delete a device owned by the user', async () => {
      const mockDevice = { id: 1, user_id: 10 };
      mockedPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockedPrisma.device.delete.mockResolvedValue({});

      await service.deleteDevice(10, 1);

      expect(mockedPrisma.device.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should reject deleting a device not owned by the user', async () => {
      mockedPrisma.device.findFirst.mockResolvedValue(null);

      await expect(service.deleteDevice(10, 999)).rejects.toThrow('设备不存在');
    });
  });

  describe('updateDeviceConfig', () => {
    it('should update device config when it exists', async () => {
      const mockDevice = {
        id: 1,
        user_id: 10,
        config: {
          device_id: 1,
          notify_enabled: true,
          debounce_interval: 30,
          notify_channels: ['email'],
        },
      };
      const mockUpdated = {
        notify_enabled: false,
        debounce_interval: 60,
        notify_channels: ['email'],
      };

      mockedPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockedPrisma.deviceConfig.update.mockResolvedValue(mockUpdated);

      const result = await service.updateDeviceConfig(10, 1, {
        notifyEnabled: false,
        debounceInterval: 60,
      });

      expect(result.notifyEnabled).toBe(false);
      expect(result.debounceInterval).toBe(60);
      expect(mockedPrisma.deviceConfig.update).toHaveBeenCalledOnce();
    });

    it('should create config when it does not exist', async () => {
      const mockDevice = {
        id: 1,
        user_id: 10,
        config: null,
      };
      const mockCreated = {
        notify_enabled: true,
        debounce_interval: 45,
        notify_channels: ['email'],
      };

      mockedPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockedPrisma.deviceConfig.create.mockResolvedValue(mockCreated);

      const result = await service.updateDeviceConfig(10, 1, {
        debounceInterval: 45,
      });

      expect(result.debounceInterval).toBe(45);
      expect(mockedPrisma.deviceConfig.create).toHaveBeenCalledOnce();
    });
  });

  describe('getDeviceStats', () => {
    it('should return correct stats for total, online, and offline', async () => {
      mockedPrisma.device.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(7);  // online

      const result = await service.getDeviceStats(10);

      expect(result.total).toBe(10);
      expect(result.online).toBe(7);
      expect(result.offline).toBe(3);
    });

    it('should handle zero devices', async () => {
      mockedPrisma.device.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getDeviceStats(10);

      expect(result.total).toBe(0);
      expect(result.online).toBe(0);
      expect(result.offline).toBe(0);
    });
  });
});
