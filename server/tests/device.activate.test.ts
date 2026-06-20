import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma —— 与 device.service.test.ts 保持一致的 mock 模式
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

/**
 * activateDevice 单元测试
 *
 * 被测方法：DeviceService.activateDevice(activationCodeStr)
 * 功能：设备端（ESP8266）用激活码换取已绑定的 device_token
 * 前置条件：激活码必须已被用户在控制台绑定（status='bound'），设备记录已创建
 */
describe('DeviceService - activateDevice（设备直连激活）', () => {
  let service: DeviceService;
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService();
  });

  // ===== 成功场景 =====

  it('✅ 激活码已绑定 → 返回 deviceToken / deviceId / deviceName', async () => {
    // 模拟已绑定的激活码，含关联设备
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 1,
      code: 'WB-ABCD-EFGH-IJKL',
      status: 'bound',
      device: {
        id: 5,
        name: '客厅红外设备',
        device_token: 'tok_abc123xyz',
      },
    });

    const result = await service.activateDevice('WB-ABCD-EFGH-IJKL');

    expect(result.deviceToken).toBe('tok_abc123xyz');
    expect(result.deviceId).toBe(5);
    expect(result.deviceName).toBe('客厅红外设备');
  });

  it('✅ 激活码关联的 device 存在且有 device_token → 正常返回', async () => {
    // 验证 device_token 字段非空时能正确透传
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 2,
      code: 'WB-TEST-0001-0002',
      status: 'bound',
      device: {
        id: 10,
        name: '卧室设备',
        device_token: 'tok_with_valid_token_456',
      },
    });

    const result = await service.activateDevice('WB-TEST-0001-0002');

    expect(result.deviceToken).toBe('tok_with_valid_token_456');
    expect(result.deviceId).toBe(10);
    expect(result.deviceName).toBe('卧室设备');
  });

  it('✅ 多次激活同一激活码返回相同 token（幂等性）', async () => {
    // 同一激活码多次调用应返回完全相同的 token，不重新生成
    const mockActivationCode = {
      id: 3,
      code: 'WB-IDEM-POTE-NT01',
      status: 'bound',
      device: {
        id: 7,
        name: '办公室设备',
        device_token: 'tok_idempotent_stable',
      },
    };

    // 每次查询都返回相同的激活码数据
    mockedPrisma.activationCode.findUnique.mockResolvedValue(mockActivationCode);

    // 第一次激活
    const first = await service.activateDevice('WB-IDEM-POTE-NT01');
    // 第二次激活
    const second = await service.activateDevice('WB-IDEM-POTE-NT01');
    // 第三次激活
    const third = await service.activateDevice('WB-IDEM-POTE-NT01');

    // 三次返回的 token 完全一致
    expect(first.deviceToken).toBe('tok_idempotent_stable');
    expect(second.deviceToken).toBe('tok_idempotent_stable');
    expect(third.deviceToken).toBe('tok_idempotent_stable');

    // deviceId 和 deviceName 也应一致
    expect(second.deviceId).toBe(first.deviceId);
    expect(third.deviceId).toBe(first.deviceId);
    expect(second.deviceName).toBe(first.deviceName);
    expect(third.deviceName).toBe(first.deviceName);

    // 确认没有触发任何写操作（无 update / create），证明是只读幂等
    expect(mockedPrisma.activationCode.update).not.toHaveBeenCalled();
    expect(mockedPrisma.device.create).not.toHaveBeenCalled();
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ===== 错误场景 =====

  it('❌ 激活码不存在 → 抛 code=2001, statusCode=400', async () => {
    mockedPrisma.activationCode.findUnique.mockResolvedValue(null);

    try {
      await service.activateDevice('WB-NONE-XXXX-YYYY');
      // 如果没有抛错，测试应失败
      expect.fail('应该抛出激活码无效的错误');
    } catch (err: any) {
      expect(err.message).toBe('激活码无效');
      expect(err.code).toBe(2001);
      expect(err.statusCode).toBe(400);
    }
  });

  it('❌ 激活码未绑定（unused）→ 抛 code=2005, statusCode=403', async () => {
    // 激活码存在但状态为 unused，且无关联设备
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 4,
      code: 'WB-UNUS-ED00-0001',
      status: 'unused',
      device: null,
    });

    try {
      await service.activateDevice('WB-UNUS-ED00-0001');
      expect.fail('应该抛出激活码尚未绑定的错误');
    } catch (err: any) {
      expect(err.message).toBe('激活码尚未绑定设备，请先在控制台绑定');
      expect(err.code).toBe(2005);
      expect(err.statusCode).toBe(403);
    }
  });

  it('❌ 激活码已禁用 → 抛 code=2003, statusCode=403', async () => {
    // 激活码状态为 disabled，即使关联了设备也应被拦截
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 5,
      code: 'WB-DISA-BLED-0001',
      status: 'disabled',
      device: {
        id: 8,
        name: '已禁用设备',
        device_token: 'tok_disabled_device',
      },
    });

    try {
      await service.activateDevice('WB-DISA-BLED-0001');
      expect.fail('应该抛出激活码已禁用的错误');
    } catch (err: any) {
      expect(err.message).toBe('激活码已禁用');
      expect(err.code).toBe(2003);
      expect(err.statusCode).toBe(403);
    }
  });

  // ===== 边界场景 =====

  it('❌ 激活码状态为 bound 但 device 关联缺失 → 抛 code=2005（防御性校验）', async () => {
    // 理论上 bound 状态应有 device，但数据异常时（device 被删但激活码未更新）需防御
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 6,
      code: 'WB-ORPH-ANED-0001',
      status: 'bound',
      device: null,
    });

    try {
      await service.activateDevice('WB-ORPH-ANED-0001');
      expect.fail('应该抛出激活码尚未绑定的错误');
    } catch (err: any) {
      expect(err.message).toBe('激活码尚未绑定设备，请先在控制台绑定');
      expect(err.code).toBe(2005);
      expect(err.statusCode).toBe(403);
    }
  });

  it('✅ 应正确调用 prisma.activationCode.findUnique 并携带 include 参数', async () => {
    // 验证查询时使用了正确的 where 条件和 include 关联设备
    mockedPrisma.activationCode.findUnique.mockResolvedValue({
      id: 7,
      code: 'WB-QUER-YCHK-0001',
      status: 'bound',
      device: {
        id: 12,
        name: '查询校验设备',
        device_token: 'tok_query_check',
      },
    });

    await service.activateDevice('WB-QUER-YCHK-0001');

    expect(mockedPrisma.activationCode.findUnique).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.activationCode.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'WB-QUER-YCHK-0001' },
        include: {
          device: {
            select: { id: true, name: true, device_token: true },
          },
        },
      }),
    );
  });
});
