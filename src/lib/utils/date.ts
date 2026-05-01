/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 获取今天的日期字符串 */
export function today(): string {
  return formatDate(new Date());
}

/** 获取日期是周几 (1=周一, 7=周日) */
export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=周日, 1=周一...
  return day === 0 ? 7 : day;
}

/** 获取一周的起止日期 (周一~周日) */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day; // 偏移到周一
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** 获取一周每天的日期字符串数组 */
export function getWeekDates(date: Date): string[] {
  const { start } = getWeekRange(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDate(d);
  });
}

/** 格式化秒数为 HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/** 格式化秒数为小时数（保留1位小数）*/
export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}
