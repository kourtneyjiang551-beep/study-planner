'use client';

import { Suspense, lazy, type ReactNode } from 'react';
import '@/lib/utils/echarts-setup';

const ReactECharts = lazy(() => import('echarts-for-react'));

export { ReactECharts };

interface ChartCardProps {
  title: string;
  children?: ReactNode;
  option?: Record<string, unknown>;
  height?: number;
  className?: string;
}

/** 图表卡片容器 — 支持 children 或 option 模式 */
export default function ChartCard({ title, children, option, height = 300, className }: ChartCardProps) {
  return (
    <div
      className={`rounded-2xl p-5 ${className ?? ''}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <Suspense
        fallback={
          <div className="flex items-center justify-center text-xs" style={{ color: 'var(--text-secondary)', height }}>
            图表加载中...
          </div>
        }
      >
        {option ? (
          <ReactECharts option={option} style={{ height }} />
        ) : (
          children
        )}
      </Suspense>
    </div>
  );
}
