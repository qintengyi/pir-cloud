import { prisma } from '../../../config/prisma';
import { logger } from '../../../utils/logger';
import { EmailService } from '../../notification/email.service';
import { OneBotService } from '../../notification/onebot.service';
import type { SmtpConfig, OneBotConfig } from '../../../types';

/**
 * 管理员 - 系统配置服务
 */
export class AdminSettingsService {
  /**
   * 获取系统配置（SMTP + OneBot）
   * @returns 系统配置对象
   */
  async getConfigs(): Promise<{ smtp: SmtpConfig | null; onebot: OneBotConfig | null }> {
    const [smtpRecord, onebotRecord] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { config_key: 'smtp' } }),
      prisma.systemConfig.findUnique({ where: { config_key: 'onebot' } }),
    ]);

    return {
      smtp: smtpRecord ? (smtpRecord.config_value as unknown as SmtpConfig) : null,
      onebot: onebotRecord ? (onebotRecord.config_value as unknown as OneBotConfig) : null,
    };
  }

  /**
   * 更新 SMTP 配置
   * @param config SMTP 配置
   * @param adminId 管理员 ID
   */
  async updateSmtpConfig(config: SmtpConfig, adminId: number): Promise<void> {
    await prisma.systemConfig.upsert({
      where: { config_key: 'smtp' },
      update: {
        config_value: config as any,
        updated_by: adminId,
      },
      create: {
        config_key: 'smtp',
        config_value: config as any,
        updated_by: adminId,
      },
    });

    EmailService.clearCache();

    logger.info({ adminId }, 'SMTP config updated');
  }

  /**
   * 更新 OneBot 配置
   * @param config OneBot 配置
   * @param adminId 管理员 ID
   */
  async updateOneBotConfig(config: OneBotConfig, adminId: number): Promise<void> {
    await prisma.systemConfig.upsert({
      where: { config_key: 'onebot' },
      update: {
        config_value: config as any,
        updated_by: adminId,
      },
      create: {
        config_key: 'onebot',
        config_value: config as any,
        updated_by: adminId,
      },
    });

    OneBotService.disconnect();

    logger.info({ adminId }, 'OneBot config updated');
  }

  /**
   * 测试 SMTP 发送
   * @param to 收件人邮箱
   */
  async testSmtp(to: string): Promise<void> {
    
    EmailService.clearCache();

    const result = await EmailService.sendTestEmail(to);

    if (!result.success) {
      const error = new Error(`测试邮件发送失败: ${result.error}`);
      (error as any).code = 5002;
      (error as any).statusCode = 500;
      throw error;
    }
  }

  /**
   * 测试 OneBot 连接
   */
  async testOneBot(): Promise<void> {
    
    OneBotService.disconnect();

    const success = await OneBotService.testConnection();

    if (!success) {
      const error = new Error('OneBot 连接失败，请检查 WebSocket 地址和 Token 配置');
      (error as any).code = 5003;
      (error as any).statusCode = 500;
      throw error;
    }
  }
}

export const adminSettingsService = new AdminSettingsService();
