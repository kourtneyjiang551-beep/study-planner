'use client';

import type { TaskStatus } from '@/types';

interface TimerControlsProps {
  status: TaskStatus;
  hasDuration: boolean;
  onStart: () => void;
  onPause: () => void;
  onComplete: (e?: React.MouseEvent) => void;
  onManualComplete: (e?: React.MouseEvent) => void;
  disabled?: boolean;
}

export function TimerControls({
  status,
  hasDuration,
  onStart,
  onPause,
  onComplete,
  onManualComplete,
  disabled = false,
}: TimerControlsProps) {
  if (status === 'completed' || status === 'skipped') return null;

  const btnBase = 'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40';

  if (status === 'in_progress') {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onPause} disabled={disabled} className={btnBase} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          ⏸ 暂停
        </button>
        <button onClick={e => onComplete(e)} disabled={disabled} className={`${btnBase} text-white`} style={{ backgroundColor: '#22c55e' }}>
          ✓ 完成
        </button>
      </div>
    );
  }

  if (hasDuration) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onStart} disabled={disabled} className={`${btnBase} text-white`} style={{ backgroundColor: 'var(--accent-1)' }}>
          ▶ 继续
        </button>
        <button onClick={e => onComplete(e)} disabled={disabled} className={`${btnBase} text-white`} style={{ backgroundColor: '#22c55e' }}>
          ✓ 完成
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={onStart} disabled={disabled} className={`${btnBase} text-white`} style={{ backgroundColor: 'var(--accent-1)' }}>
        ▶ 开始
      </button>
      <button onClick={e => onManualComplete(e)} disabled={disabled} className={btnBase} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
        ✋ 完成
      </button>
    </div>
  );
}
