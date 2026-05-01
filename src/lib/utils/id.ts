/** 生成 UUID v4 */
export function generateId(): string {
  return crypto.randomUUID();
}

/** 获取当前 ISO 时间戳 */
export function now(): string {
  return new Date().toISOString();
}
