'use client';

import { motion } from 'framer-motion';
import { formatDuration } from '@/lib/utils/date';

interface TimerDisplayProps {
  seconds: number;
  isActive: boolean;
  isAbnormal?: boolean;
}

export function TimerDisplay({ seconds, isActive, isAbnormal = false }: TimerDisplayProps) {
  const timeStr = formatDuration(seconds);

  if (isAbnormal) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-sm font-bold tabular-nums" style={{ color: '#ef4444' }}>
          {timeStr}
        </span>
        <span className="text-[9px]" style={{ color: '#ef4444' }}>计时异常</span>
      </div>
    );
  }

  if (isActive) {
    return (
      <motion.span
        className="font-mono text-sm font-bold tabular-nums"
        style={{ color: 'var(--accent-1)' }}
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {timeStr}
      </motion.span>
    );
  }

  // 有时间但未在计时
  if (seconds > 0) {
    return (
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
        {timeStr}
      </span>
    );
  }

  return (
    <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
      00:00:00
    </span>
  );
}
