/**
 * CSV 导出工具
 */

/**
 * 将数据数组转换为 CSV 字符串
 * @param headers 表头定义 [{ key, label }]
 * @param rows 数据行数组
 * @returns CSV 格式字符串
 */
export function toCsv<T extends Record<string, any>>(
  headers: { key: string; label: string }[],
  rows: T[],
): string {
  
  const headerLine = headers.map((h) => escapeCsvField(h.label)).join(',');
  const lines = [headerLine];

  for (const row of rows) {
    const values = headers.map((h) => {
      const value = row[h.key];
      return escapeCsvField(value !== null && value !== undefined ? String(value) : '');
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * 转义 CSV 字段
 * 包含逗号、引号或换行符的字段需要用双引号包裹
 * @param value 原始值
 * @returns 转义后的 CSV 字段
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 生成 CSV 文件名（含日期时间戳）
 * @param prefix 文件名前缀
 * @returns CSV 文件名
 */
export function generateCsvFileName(prefix: string): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `${prefix}_${dateStr}.csv`;
}
