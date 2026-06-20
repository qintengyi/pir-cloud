import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import type { SmtpConfig } from '../../types';

/**
 * 邮件发送服务
 * 负责发送验证码邮件、告警邮件、测试邮件
 * 支持失败重试（最多3次，指数退避 1s/2s/4s）
 */
class EmailServiceClass {
  private transporter: Transporter | null = null;
  private lastConfigHash: string = '';

  /**
   * 从数据库获取 SMTP 配置
   * @returns SMTP 配置对象，未配置时返回 null
   */
  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const configRecord = await prisma.systemConfig.findUnique({
      where: { config_key: 'smtp' },
    });

    if (!configRecord) {
      return null;
    }

    const smtpConfig = configRecord.config_value as unknown as SmtpConfig;

    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.from) {
      return null;
    }

    return smtpConfig;
  }

  /**
   * 获取或创建邮件 transporter
   * 如果 SMTP 配置发生变化则重新创建
   * @returns nodemailer Transporter 实例
   */
  private async getTransporter(): Promise<Transporter> {
    const smtpConfig = await this.getSmtpConfig();

    if (!smtpConfig) {
      throw new Error('SMTP 配置未设置，请在管理后台配置 SMTP 参数');
    }

    const configHash = JSON.stringify(smtpConfig);
    if (this.transporter && configHash === this.lastConfigHash) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure ?? smtpConfig.port === 465,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },

      from: smtpConfig.from,
    });

    this.lastConfigHash = configHash;
    logger.info('SMTP transporter created/recreated');

    return this.transporter;
  }

  /**
   * 带重试的邮件发送
   * 最多重试3次，指数退避 1s/2s/4s
   * @param mailOptions 邮件选项
   * @param maxAttempts 最大重试次数
   * @returns 发送结果
   */
  private async retrySend(
    mailOptions: nodemailer.SendMailOptions,
    maxAttempts: number = 3,
  ): Promise<{ success: boolean; messageId?: string; attempts: number; error?: string }> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transporter = await this.getTransporter();

        const smtpConfig = await this.getSmtpConfig();
        const info = await transporter.sendMail({ from: smtpConfig?.from, ...mailOptions });
        logger.info({ messageId: info.messageId, attempt }, 'Email sent successfully');
        return { success: true, messageId: info.messageId, attempts: attempt };
      } catch (err: any) {
        lastError = err.message || String(err);
        logger.warn({ attempt, error: lastError, maxAttempts }, 'Email send attempt failed');

        if (attempt < maxAttempts) {

          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, attempts: maxAttempts, error: lastError };
  }

  /**
   * 发送验证码邮件
   * @param to 收件人邮箱
   * @param code 验证码
   * @param type 验证码类型（注册/重置密码）
   */
  async sendVerificationEmail(
    to: string,
    code: string,
    type: 'register' | 'reset_password',
  ): Promise<void> {
    const subject = type === 'register' ? '【pir-cloud】注册验证码' : '【pir-cloud】密码重置验证码';
    const purpose = type === 'register' ? '注册账号' : '重置密码';

    const html = `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: #f0f4f8; padding: 24px; border-radius: 8px;">
          <h2 style="color: #1976d2; margin: 0 0 16px 0;">pir-cloud 验证码</h2>
          <p style="color: #555; font-size: 14px; margin: 0 0 16px 0;">您正在进行<strong>${purpose}</strong>操作，验证码为：</p>
          <div style="background: #fff; padding: 20px; border-radius: 6px; text-align: center; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin: 0;">验证码5分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件。</p>
        </div>
        <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 16px;">© 2025 pir-cloud</p>
      </div>
    `;

    const result = await this.retrySend({ to, subject, html });

    if (!result.success) {
      logger.error({ to, error: result.error }, 'Failed to send verification email after retries');
      throw new Error(`验证码邮件发送失败: ${result.error}`);
    }
  }

  /**
   * 发送告警邮件
   * @param to 收件人邮箱
   * @param deviceName 设备名称
   * @param alarmTime 告警时间
   * @param alarmType 告警类型描述
   */
  async sendAlarmEmail(
    to: string,
    deviceName: string,
    alarmTime: Date,
    alarmType: string = '人体检测告警',
  ): Promise<{ success: boolean; error?: string }> {
    const formattedTime = alarmTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const html = `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: #fff3e0; padding: 24px; border-radius: 8px; border-left: 4px solid #ff9800;">
          <h2 style="color: #e65100; margin: 0 0 16px 0;">⚠️ 设备告警通知</h2>
          <p style="color: #555; font-size: 14px; margin: 0 0 12px 0;">您的设备检测到异常状态：</p>
          <table style="width: 100%; font-size: 14px; color: #333;">
            <tr><td style="padding: 4px 0; color: #999;">设备名称</td><td style="padding: 4px 0;"><strong>${deviceName}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #999;">告警类型</td><td style="padding: 4px 0;"><strong style="color: #e65100;">${alarmType}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #999;">告警时间</td><td style="padding: 4px 0;">${formattedTime}</td></tr>
          </table>
        </div>
        <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 16px;">© 2025 pir-cloud · 请及时登录面板查看详情</p>
      </div>
    `;

    const subject = `【pir-cloud告警】${deviceName} - ${alarmType}`;
    const result = await this.retrySend({ to, subject, html });

    if (!result.success) {
      logger.error({ to, deviceName, error: result.error }, 'Failed to send alarm email after retries');
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  /**
   * 发送持续在线提醒邮件
   * 设备持续在线达到用户设定间隔时触发，与告警邮件相互独立，不影响现有告警邮件文案
   * @param to 收件人邮箱
   * @param deviceName 设备名称
   * @param remindTime 提醒时间
   * @param onlineMinutes 已持续在线分钟数
   */
  async sendOnlineRemindEmail(
    to: string,
    deviceName: string,
    remindTime: Date,
    onlineMinutes: number,
  ): Promise<{ success: boolean; error?: string }> {
    const formattedTime = remindTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const html = `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: #e3f2fd; padding: 24px; border-radius: 8px; border-left: 4px solid #1976d2;">
          <h2 style="color: #1565c0; margin: 0 0 16px 0;">ℹ️ 设备持续在线提醒</h2>
          <p style="color: #555; font-size: 14px; margin: 0 0 12px 0;">您的设备已持续在线运行：</p>
          <table style="width: 100%; font-size: 14px; color: #333;">
            <tr><td style="padding: 4px 0; color: #999;">设备名称</td><td style="padding: 4px 0;"><strong>${deviceName}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #999;">已在线时长</td><td style="padding: 4px 0;"><strong style="color: #1565c0;">${onlineMinutes} 分钟</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #999;">提醒时间</td><td style="padding: 4px 0;">${formattedTime}</td></tr>
          </table>
        </div>
        <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 16px;">© 2025 pir-cloud · 设备运行正常</p>
      </div>
    `;

    const subject = `【pir-cloud】${deviceName} 已持续在线 ${onlineMinutes} 分钟`;
    const result = await this.retrySend({ to, subject, html });

    if (!result.success) {
      logger.error({ to, deviceName, error: result.error }, 'Failed to send online remind email after retries');
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  /**
   * 发送测试邮件
   * @param to 收件人邮箱
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    const html = `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: #e8f5e9; padding: 24px; border-radius: 8px;">
          <h2 style="color: #2e7d32; margin: 0 0 16px 0;">✅ SMTP 测试邮件</h2>
          <p style="color: #555; font-size: 14px;">这是一封来自 pir-cloud 系统的测试邮件，用于验证 SMTP 配置是否正确。</p>
          <p style="color: #999; font-size: 12px;">发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        </div>
        <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 16px;">© 2025 pir-cloud</p>
      </div>
    `;

    const result = await this.retrySend({ to, subject: '【pir-cloud】SMTP测试邮件', html });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  /**
   * 清除缓存的 transporter（配置变更后调用）
   */
  clearCache(): void {
    this.transporter = null;
    this.lastConfigHash = '';
  }
}

export const EmailService = new EmailServiceClass();
