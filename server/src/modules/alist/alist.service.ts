import { config } from '../../config/index';
import { logger } from '../../utils/logger';

/**
 * Alist 文件存储服务
 * 封装 Alist API 调用，用于固件文件的上传、删除、下载和存在性检查
 * 使用 Node.js 内置 fetch（Node 18+），不引入额外依赖
 */

/** Alist API 列表响应 */
interface AlistListResponse {
  code: number;
  message: string;
  data: {
    content: Array<{ name: string; size: number; is_dir: boolean; sign?: string }> | null;
    total: number;
  } | null;
}

/** Alist API 通用响应 */
interface AlistBaseResponse {
  code: number;
  message: string;
  data: unknown;
}

export class AlistService {
  private get baseUrl(): string {
    return config.alist.baseUrl;
  }

  private get apiToken(): string {
    return config.alist.apiToken;
  }

  private get basePath(): string {
    return config.alist.firmwareBasePath;
  }

  /**
   * 上传文件到 Alist
   * @param filename 文件名（不含路径）
   * @param buffer 文件内容
   */
  async uploadFile(filename: string, buffer: Buffer): Promise<void> {
    const filePath = `${this.basePath}/${filename}`;
    const encodedFilePath = `${this.basePath}/${encodeURIComponent(filename)}`;

    const response = await fetch(`${this.baseUrl}/api/fs/put`, {
      method: 'PUT',
      headers: {
        'Authorization': this.apiToken,
        'File-Path': encodedFilePath,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buffer.length),
      },
      body: buffer,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text, filePath }, 'Alist upload failed (HTTP error)');
      const error = new Error(`Alist 文件上传失败: HTTP ${response.status}`);
      (error as any).code = 5001;
      (error as any).statusCode = 500;
      throw error;
    }

    const result = (await response.json()) as AlistBaseResponse;
    if (result.code !== 200) {
      logger.error({ code: result.code, message: result.message, filePath }, 'Alist upload failed (API error)');
      const error = new Error(`Alist 文件上传失败: ${result.message}`);
      (error as any).code = 5001;
      (error as any).statusCode = 500;
      throw error;
    }

    logger.info({ filename, size: buffer.length, filePath }, 'Firmware uploaded to Alist');
  }

  /**
   * 删除 Alist 上的文件
   * @param filename 文件名（不含路径）
   */
  async deleteFile(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/fs/remove`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dir: this.basePath,
        names: [filename],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text, filename }, 'Alist delete failed (HTTP error)');
      const error = new Error(`Alist 文件删除失败: HTTP ${response.status}`);
      (error as any).code = 5001;
      (error as any).statusCode = 500;
      throw error;
    }

    const result = (await response.json()) as AlistBaseResponse;
    if (result.code !== 200) {
      logger.error({ code: result.code, message: result.message, filename }, 'Alist delete failed (API error)');
      const error = new Error(`Alist 文件删除失败: ${result.message}`);
      (error as any).code = 5001;
      (error as any).statusCode = 500;
      throw error;
    }

    logger.info({ filename }, 'Firmware deleted from Alist');
  }

  /**
   * 获取文件的下载 URL
   * @param filename 文件名（不含路径）
   * @returns 完整的下载 URL
   */
  getDownloadUrl(filename: string): string {
    return `${this.baseUrl}/d${this.basePath}/${encodeURIComponent(filename)}`;
  }

  /**
   * 下载文件内容（后端代理，带 Alist sign 鉴权）
   * 替代 302 重定向方式，避免客户端直接访问 Alist 时 401
   * @param filename 文件名（不含路径）
   * @returns 文件 Buffer
   */
  async downloadFile(filename: string): Promise<Buffer> {
    // 先列出文件获取 sign
    const files = await this.listFiles();
    const file = files.find((f) => f.name === filename);
    if (!file) {
      throw new Error(`Alist 文件不存在: ${filename}`);
    }

    // 构造带 sign 的下载 URL
    let downloadUrl = `${this.baseUrl}/d${this.basePath}/${encodeURIComponent(filename)}`;
    if (file.sign) {
      downloadUrl += `?sign=${encodeURIComponent(file.sign)}`;
    }

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': this.apiToken,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text, filename, url: downloadUrl }, 'Alist download failed (HTTP error)');
      const error = new Error(`Alist 文件下载失败: HTTP ${response.status}`);
      (error as any).code = 5001;
      (error as any).statusCode = 500;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 检查文件是否存在于 Alist
   * @param filename 文件名（不含路径）
   * @returns 是否存在
   */
  async fileExists(filename: string): Promise<boolean> {
    const files = await this.listFiles();
    return files.some((f) => f.name === filename);
  }

  /**
   * 列出 Alist 固件目录下的所有文件
   * @returns 文件名列表
   */
  async listFiles(): Promise<Array<{ name: string; size: number; sign?: string }>> {
    const response = await fetch(`${this.baseUrl}/api/fs/list`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: this.basePath,
        page: 1,
        per_page: 100,
        refresh: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error({ status: response.status, body: text }, 'Alist list failed (HTTP error)');
      return [];
    }

    const result = (await response.json()) as AlistListResponse;
    if (result.code !== 200 || !result.data || !result.data.content) {
      logger.warn({ code: result.code, message: result.message }, 'Alist list returned no data');
      return [];
    }

    return result.data.content
      .filter((item) => !item.is_dir)
      .map((item) => ({ name: item.name, size: item.size, sign: item.sign }));
  }
}

export const alistService = new AlistService();
