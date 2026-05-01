'use client';

import { useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export interface ChartColors {
  bgSecondary: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
}

/** 生成 ECharts 通用基础配置 */
export function useChartBase() {
  const { theme } = useTheme();
  const c = theme.colors;

  return useMemo(() => ({
    backgroundColor: 'transparent' as const,
    textStyle: { color: c.textSecondary, fontSize: 11 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    tooltip: {
      backgroundColor: c.bgSecondary,
      borderColor: c.border,
      textStyle: { color: c.textPrimary, fontSize: 12 },
    },
    legend: {
      textStyle: { color: c.textSecondary, fontSize: 11 },
    },
    axisLabel: { color: c.textSecondary },
    axisLine: { lineStyle: { color: c.border } },
    splitLine: { lineStyle: { color: c.border } },
    splitArea: { areaStyle: { color: ['transparent'] } },
  }), [c]);
}
