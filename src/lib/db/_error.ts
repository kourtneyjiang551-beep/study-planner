import { toast } from '@/components/ui/Toast';

/** 共享错误处理 */
export function handleDBError(action: string, error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[DB] ${action}失败:`, error);
  toast(`${action}失败: ${msg}`, 'error');
  throw error;
}
