'use client';

import type { PointsLog } from '@/types';

interface PointsLogListProps {
  logs: PointsLog[];
}

export default function PointsLogList({ logs }: PointsLogListProps) {
  if (logs.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-3xl">📜</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          还没有积分记录
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl divide-y"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}
    >
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{log.description}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {log.created_at.slice(0, 16).replace('T', ' ')}
            </p>
          </div>
          <span
            className="text-sm font-bold"
            style={{ color: log.type === 'earn' ? '#22c55e' : '#FF6B6B' }}
          >
            {log.type === 'earn' ? '+' : '-'}{log.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
