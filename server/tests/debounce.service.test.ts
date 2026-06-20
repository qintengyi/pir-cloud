import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/config/prisma', () => {
  const mockPrisma = {
    event: {
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

import { prisma } from '../src/config/prisma';
import { DebounceService } from '../src/modules/notification/debounce.service';

describe('DebounceService', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow trigger when no previous alarm exists', async () => {
    mockedPrisma.event.findFirst.mockResolvedValue(null);

    const result = await DebounceService.shouldTrigger(1, 30);
    expect(result).toBe(true);
  });

  it('should NOT trigger when last alarm is within debounce window (30s)', async () => {
    const recentAlarm = {
      created_at: new Date(Date.now() - 10 * 1000), // 10 seconds ago
    };
    mockedPrisma.event.findFirst.mockResolvedValue(recentAlarm);

    const result = await DebounceService.shouldTrigger(1, 30);
    expect(result).toBe(false);
  });

  it('should allow trigger when last alarm is beyond debounce window', async () => {
    const oldAlarm = {
      created_at: new Date(Date.now() - 60 * 1000), // 60 seconds ago
    };
    mockedPrisma.event.findFirst.mockResolvedValue(oldAlarm);

    const result = await DebounceService.shouldTrigger(1, 30);
    expect(result).toBe(true);
  });

  it('should respect custom debounce interval', async () => {
    // 10 seconds ago, with 15s interval → should NOT trigger (within window)
    const recentAlarm = {
      created_at: new Date(Date.now() - 10 * 1000),
    };
    mockedPrisma.event.findFirst.mockResolvedValue(recentAlarm);
    const result1 = await DebounceService.shouldTrigger(1, 15);
    expect(result1).toBe(false);

    // 20 seconds ago, with 15s interval → should trigger (beyond window)
    const oldAlarm = {
      created_at: new Date(Date.now() - 20 * 1000),
    };
    mockedPrisma.event.findFirst.mockResolvedValue(oldAlarm);
    const result2 = await DebounceService.shouldTrigger(1, 15);
    expect(result2).toBe(true);
  });

  it('should query events filtered by device_id and type=alarm', async () => {
    mockedPrisma.event.findFirst.mockResolvedValue(null);

    await DebounceService.shouldTrigger(42, 30);

    const callArgs = mockedPrisma.event.findFirst.mock.calls[0][0];
    expect(callArgs.where.device_id).toBe(42);
    expect(callArgs.where.type).toBe('alarm');
    expect(callArgs.orderBy.created_at).toBe('desc');
  });
});
