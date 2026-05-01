import { describe, it, expect } from 'vitest';
import {
  formatDate,
  today,
  getDayOfWeek,
  getWeekRange,
  getWeekDates,
  formatDuration,
  formatHours,
} from '../date';

describe('formatDate', () => {
  it('格式化为 YYYY-MM-DD', () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe('2024-01-15');
  });

  it('月份和日期补零', () => {
    expect(formatDate(new Date(2024, 2, 5))).toBe('2024-03-05');
  });

  it('处理12月31日', () => {
    expect(formatDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  it('处理1月1日', () => {
    expect(formatDate(new Date(2025, 0, 1))).toBe('2025-01-01');
  });
});

describe('today', () => {
  it('返回今天的日期字符串', () => {
    const now = new Date();
    const expected = formatDate(now);
    expect(today()).toBe(expected);
  });
});

describe('getDayOfWeek', () => {
  it('周一返回 1', () => {
    // 2024-01-01 是周一
    expect(getDayOfWeek('2024-01-01')).toBe(1);
  });

  it('周日返回 7（非 JS 默认的 0）', () => {
    // 2024-01-07 是周日
    expect(getDayOfWeek('2024-01-07')).toBe(7);
  });

  it('周三返回 3', () => {
    // 2024-01-03 是周三
    expect(getDayOfWeek('2024-01-03')).toBe(3);
  });

  it('周六返回 6', () => {
    // 2024-01-06 是周六
    expect(getDayOfWeek('2024-01-06')).toBe(6);
  });
});

describe('getWeekRange', () => {
  it('周中日期返回正确的周一到周日', () => {
    // 2024-01-03 是周三
    const { start, end } = getWeekRange(new Date(2024, 0, 3));
    expect(formatDate(start)).toBe('2024-01-01'); // 周一
    expect(formatDate(end)).toBe('2024-01-07');   // 周日
  });

  it('周一本身返回当周', () => {
    const { start, end } = getWeekRange(new Date(2024, 0, 1));
    expect(formatDate(start)).toBe('2024-01-01');
    expect(formatDate(end)).toBe('2024-01-07');
  });

  it('周日返回当周（不是下一周）', () => {
    const { start, end } = getWeekRange(new Date(2024, 0, 7));
    expect(formatDate(start)).toBe('2024-01-01');
    expect(formatDate(end)).toBe('2024-01-07');
  });

  it('跨月的周', () => {
    // 2024-01-29 是周一，该周跨到2月
    const { start, end } = getWeekRange(new Date(2024, 0, 31));
    expect(formatDate(start)).toBe('2024-01-29');
    expect(formatDate(end)).toBe('2024-02-04');
  });

  it('start 时间为 00:00:00', () => {
    const { start } = getWeekRange(new Date(2024, 0, 3));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it('end 时间为 23:59:59', () => {
    const { end } = getWeekRange(new Date(2024, 0, 3));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });
});

describe('getWeekDates', () => {
  it('返回 7 个日期', () => {
    const dates = getWeekDates(new Date(2024, 0, 3));
    expect(dates).toHaveLength(7);
  });

  it('从周一开始到周日结束', () => {
    const dates = getWeekDates(new Date(2024, 0, 3));
    expect(dates[0]).toBe('2024-01-01'); // 周一
    expect(dates[6]).toBe('2024-01-07'); // 周日
  });

  it('日期连续递增', () => {
    const dates = getWeekDates(new Date(2024, 0, 3));
    expect(dates).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
      '2024-01-07',
    ]);
  });

  it('跨月周返回正确日期', () => {
    const dates = getWeekDates(new Date(2024, 0, 31));
    expect(dates[0]).toBe('2024-01-29');
    expect(dates[6]).toBe('2024-02-04');
  });
});

describe('formatDuration', () => {
  it('0 秒显示 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('纯秒数', () => {
    expect(formatDuration(45)).toBe('00:00:45');
  });

  it('分钟和秒', () => {
    expect(formatDuration(125)).toBe('00:02:05');
  });

  it('完整的时分秒', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('大时数', () => {
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  it('超过 99 小时', () => {
    expect(formatDuration(360000)).toBe('100:00:00');
  });
});

describe('formatHours', () => {
  it('0 秒返回 0.0', () => {
    expect(formatHours(0)).toBe('0.0');
  });

  it('3600 秒返回 1.0', () => {
    expect(formatHours(3600)).toBe('1.0');
  });

  it('5400 秒（1.5小时）返回 1.5', () => {
    expect(formatHours(5400)).toBe('1.5');
  });

  it('保留1位小数', () => {
    expect(formatHours(7200)).toBe('2.0');
  });

  it('非整数小时', () => {
    // 1800秒 = 0.5小时
    expect(formatHours(1800)).toBe('0.5');
  });
});
