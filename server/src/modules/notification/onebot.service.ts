import WebSocket from 'ws';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import type { OneBotConfig } from '../../types';

/**
 * OneBot v11 WebSocket 客户端服务
 * 负责通过 OneBot 协议向 QQ 用户发送私聊消息
 * 支持自动重连，连接失败时降级到邮箱通知
 */
class OneBotServiceClass {
  private ws: WebSocket | null = null;
  private currentConfig: OneBotConfig | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private stopped: boolean = false;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_BASE_DELAY = 3000; 

  /**
   * 从数据库获取 OneBot 配置
   * @returns OneBot 配置对象，未配置时返回 null
   */
  async getConfig(): Promise<OneBotConfig | null> {
    const configRecord = await prisma.systemConfig.findUnique({
      where: { config_key: 'onebot' },
    });

    if (!configRecord) {
      return null;
    }

    const onebotConfig = configRecord.config_value as unknown as OneBotConfig;

    if (!onebotConfig.wsUrl) {
      return null;
    }

    return onebotConfig;
  }

  /**
   * 连接到 OneBot WebSocket 服务器
   */
  async connect(): Promise<void> {
    const config = await this.getConfig();

    if (!config) {
      logger.warn('OneBot config not set, skipping connection');
      return;
    }

    if (this.currentConfig && JSON.stringify(this.currentConfig) !== JSON.stringify(config)) {
      this.disconnect();
    }

    if (this.isConnected) {
      return;
    }

    this.currentConfig = config;

    return new Promise<void>((resolve, reject) => {
      try {
        const headers: Record<string, string> = {};
        if (config.token) {
          headers['Authorization'] = `Bearer ${config.token}`;
        }

        this.ws = new WebSocket(config.wsUrl, { headers });

        const connectionTimeout = setTimeout(() => {
          logger.warn('OneBot WebSocket connection timeout');
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info({ wsUrl: config.wsUrl }, 'OneBot WebSocket connected');
          resolve();
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          logger.warn({ code, reason: reason.toString() }, 'OneBot WebSocket closed, will reconnect');
          this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          logger.error({ err }, 'OneBot WebSocket error, will reconnect');
          this.scheduleReconnect();
          reject(err);
        });

        this.ws.on('message', (data) => {
          logger.debug({ data: data.toString() }, 'OneBot message received');
        });
      } catch (err) {
        logger.error({ err }, 'Failed to connect to OneBot WebSocket');
        this.scheduleReconnect();
        reject(err);
      }
    });
  }

disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 安排自动重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('OneBot max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;

    const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      logger.info({ attempt: this.reconnectAttempts }, 'Attempting OneBot reconnect...');
      await this.connect();
    }, delay);
  }

  /**
   * 发送私聊消息
   * @param qqNumber QQ 号
   * @param message 消息内容
   * @returns 是否发送成功
   */
  async sendMessage(qqNumber: string, message: string): Promise<boolean> {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {

      await this.connect();
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        logger.warn('OneBot not connected, cannot send message');
        return false;
      }
    }

    try {

      const payload = {
        action: 'send_private_msg',
        params: {
          user_id: parseInt(qqNumber, 10),
          message: message,
        },
      };

      const messagePromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 10000); 

        const messageHandler = (data: WebSocket.RawData): void => {
          try {
            const response = JSON.parse(data.toString());
            if (response.echo === payload.action || response.retcode !== undefined) {
              clearTimeout(timeout);
              this.ws?.off('message', messageHandler);
              resolve(response.retcode === 0 || response.status === 'ok');
            }
          } catch {

          }
        };

        this.ws?.on('message', messageHandler);
      });

      this.ws.send(JSON.stringify(payload));

      const success = await messagePromise;

      if (success) {
        logger.info({ qqNumber }, 'OneBot message sent successfully');
      } else {
        logger.warn({ qqNumber }, 'OneBot message send failed (timeout or error)');
      }

      return success;
    } catch (err) {
      logger.error({ err, qqNumber }, 'Failed to send OneBot message');
      return false;
    }
  }

  /**
   * 测试 OneBot 连接
   * @returns 是否连接成功
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const OneBotService = new OneBotServiceClass();
