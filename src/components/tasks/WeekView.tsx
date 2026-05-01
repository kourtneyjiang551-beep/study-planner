'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getWeekDates, formatDate } from '@/lib/utils/date';

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

interface WeekViewProps {
  /** 当前选中的日期 YYYY-MM-DD */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** 当前周基准日期 */
  weekBaseDate: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export default function WeekView({
  selectedDate,
  onSelectDate,
  weekBaseDate,
  onPrevWeek,
  onNextWeek,
}: WeekViewProps) {
  const todayStr = formatDate(new Date());
  const weekDates = useMemo(() => getWeekDates(weekBaseDate), [weekBaseDate]);

  // 计算周标签: "2026年4月第1周"（用周四确定所属月份，跨月时更直觉）
  const weekLabel = useMemo(() => {
    const thursday = new Date(weekDates[3] + 'T00:00:00');
    const year = thursday.getFullYear();
    const month = thursday.getMonth() + 1;
    const dayOfMonth = thursday.getDate();
    const weekNum = Math.ceil(dayOfMonth / 7);
    return `${year}年${month}月第${weekNum}周`;
  }, [weekDates]);

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* 周导航 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onPrevWeek}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {weekLabel}
        </span>
        <button
          onClick={onNextWeek}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 7 天日期选择器 */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((dateStr, i) => {
          const d = new Date(dateStr + 'T00:00:00');
          const dayNum = d.getDate();
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className="flex flex-col items-center gap-0.5 rounded-xl py-2 transition-all"
              style={{
                backgroundColor: isSelected ? 'var(--accent-1)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs" style={{ opacity: isSelected ? 0.8 : 0.5 }}>
                周{DAY_LABELS[i]}
              </span>
              <span className="text-base font-semibold">{dayNum}</span>
              {isToday && !isSelected && (
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent-1)' }}
                />
              )}
              {isToday && isSelected && (
                <div className="h-1 w-1 rounded-full bg-white/60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
