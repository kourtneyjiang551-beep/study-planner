'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useStatsData } from '@/lib/hooks/useStatsData';
import { formatDate } from '@/lib/utils/date';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import ChartCard, { ReactECharts } from '@/components/charts/ChartCard';
import { useChartBase } from '@/components/charts/useChartTheme';
import ChartExportButton from '@/components/charts/ChartExportButton';

/** 默认最近 30 天 */
function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatDate(start), end: formatDate(end) };
}

/** 短日期标签: MM/DD */
function shortDate(d: string) {
  return d.slice(5).replace('-', '/');
}

export default function StatsPage() {
  const { theme, t } = useTheme();
  const { activeChildId } = useActiveChild();
  const colors = theme.colors;
  const [range, setRange] = useState(defaultRange);
  const stats = useStatsData(activeChildId, range);
  const base = useChartBase();

  const xAxisDates = stats.dailyCompletion.map(d => shortDate(d.date));

  // 图表 1: 每日计划完成情况
  const chart1Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' as const },
    legend: { ...base.legend, data: ['计划数', '完成数'], top: 0 },
    grid: { ...base.grid, top: 30 },
    xAxis: { type: 'category' as const, data: xAxisDates, axisLabel: { ...base.axisLabel, fontSize: 10 } },
    yAxis: { type: 'value' as const, minInterval: 1, axisLabel: base.axisLabel },
    series: [
      { name: '计划数', type: 'bar', data: stats.dailyCompletion.map(d => d.planned), itemStyle: { color: colors.accent3, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
      { name: '完成数', type: 'bar', data: stats.dailyCompletion.map(d => d.completed), itemStyle: { color: colors.accent1, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
    ],
  }), [base, stats.dailyCompletion, xAxisDates, colors]);

  // 图表 2: 学习/运动/娱乐时间
  const chart2Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' as const },
    legend: { ...base.legend, data: ['学习', '运动', '娱乐'], top: 0 },
    grid: { ...base.grid, top: 30 },
    xAxis: { type: 'category' as const, data: xAxisDates, axisLabel: { ...base.axisLabel, fontSize: 10 } },
    yAxis: { type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${Math.round(v / 60)}m` } },
    series: [
      { name: '学习', type: 'bar', stack: 'time', data: stats.categoryTime.map(d => d.academic), itemStyle: { color: colors.accent3 }, barMaxWidth: 24 },
      { name: '运动', type: 'bar', stack: 'time', data: stats.categoryTime.map(d => d.sport), itemStyle: { color: colors.accent2 }, barMaxWidth: 24 },
      { name: '娱乐', type: 'bar', stack: 'time', data: stats.categoryTime.map(d => d.entertainment), itemStyle: { color: colors.accent4 }, barMaxWidth: 24 },
    ],
  }), [base, stats.categoryTime, xAxisDates, colors]);

  // 图表 3: 各科目总用时占比
  const chart3Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'item' as const, formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${Math.round(p.value / 60)}分钟 (${p.percent}%)` },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
      data: stats.subjectShare.map(s => ({ name: s.name, value: s.seconds, itemStyle: { color: s.color } })),
      label: { color: colors.textSecondary, fontSize: 11 },
      emphasis: { label: { fontSize: 13, fontWeight: 'bold' as const } },
    }],
  }), [base, stats.subjectShare, colors]);

  // 图表 4: 各科目每日用时堆叠
  const chart4Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' as const, formatter: (params: Array<{ seriesName: string; value: number; marker: string }>) => params.filter(p => p.value > 0).map(p => `${p.marker} ${p.seriesName}: ${p.value}分钟`).join('<br/>') },
    legend: { ...base.legend, data: stats.dailySubjectStack.subjects.map(s => s.name), top: 0, type: 'scroll' as const },
    grid: { ...base.grid, top: 30 },
    xAxis: { type: 'category' as const, data: stats.dailySubjectStack.dates.map(shortDate), axisLabel: { ...base.axisLabel, fontSize: 10 } },
    yAxis: { type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}m` } },
    series: stats.dailySubjectStack.subjects.map(s => ({ name: s.name, type: 'bar', stack: 'subject', data: s.data, itemStyle: { color: s.color }, barMaxWidth: 24 })),
  }), [base, stats.dailySubjectStack, colors]);

  // 图表 5: 计划用时 vs 实际用时（水平条形图）
  const chart5Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' as const, formatter: (params: Array<{ seriesName: string; value: number; marker: string }>) => params.map(p => `${p.marker} ${p.seriesName}: ${p.value}分钟`).join('<br/>') },
    legend: { ...base.legend, data: ['计划用时', '实际用时'], top: 0 },
    grid: { left: 80, right: 20, top: 30, bottom: 10 },
    xAxis: { type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}m` } },
    yAxis: { type: 'category' as const, data: stats.plannedVsActual.map(d => d.subjectName), axisLabel: { ...base.axisLabel, fontSize: 11 } },
    series: [
      { name: '计划用时', type: 'bar', data: stats.plannedVsActual.map(d => d.plannedMinutes), itemStyle: { color: colors.accent3, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 },
      { name: '实际用时', type: 'bar', data: stats.plannedVsActual.map(d => d.actualMinutes), itemStyle: { color: colors.accent1, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 },
    ],
  }), [base, stats.plannedVsActual, colors]);

  // 图表 6: 完成率趋势线
  const chart6Option = useMemo(() => ({
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' as const },
    grid: { ...base.grid, top: 30 },
    xAxis: { type: 'category' as const, data: xAxisDates, axisLabel: { ...base.axisLabel, fontSize: 10 } },
    yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${Math.round(v)}%` } },
    series: [{
      name: '完成率', type: 'line',
      data: stats.dailyCompletion.map(d => d.planned > 0 ? Math.round((d.completed / d.planned) * 100) : null),
      smooth: true, lineStyle: { color: colors.accent1, width: 2.5 }, itemStyle: { color: colors.accent1 },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${colors.accent1}40` }, { offset: 1, color: `${colors.accent1}05` }] } },
      symbol: 'circle', symbolSize: 6,
    }],
  }), [base, stats.dailyCompletion, xAxisDates, colors]);

  // 图表 7: 科目完成效率雷达图
  const chart7Option = useMemo(() => {
    const topSubjects = [...stats.subjectShare].sort((a, b) => b.seconds - a.seconds).slice(0, 6);
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'item' as const, formatter: (p: { name: string; value: number }) => `${p.name}: ${Math.round(p.value / 60)}分钟` },
      radar: {
        indicator: [{ name: '总用时(分钟)', max: topSubjects.length > 0 ? Math.ceil(topSubjects[0].seconds / 60 / 10) * 10 : 60 }, ...topSubjects.map(s => ({ name: s.name, max: Math.ceil(s.seconds / 60 / 10) * 10 }))],
        axisName: { color: colors.textSecondary, fontSize: 11 },
        ...Object.fromEntries(Object.entries(base).filter(([k]) => ['splitArea', 'splitLine', 'axisLine'].includes(k))),
      },
      series: [{
        type: 'radar', data: topSubjects.map(s => Math.round(s.seconds / 60)),
        lineStyle: { color: colors.accent1, width: 2 }, areaStyle: { color: `${colors.accent1}25` },
        itemStyle: { color: colors.accent1 },
        emphasis: { lineStyle: { width: 3 }, areaStyle: { color: `${colors.accent1}40` } },
      }],
    };
  }, [base, stats.subjectShare, colors]);

  const hasData = stats.dailyCompletion.some(d => d.planned > 0);
  console.log('[Stats] hasData:', hasData, 'dailyCompletion:', stats.dailyCompletion.slice(0, 5), 'records total:', stats.dailyCompletion.reduce((s, d) => s + d.planned, 0));

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </a>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            📊 {t('study')}数据统计
          </h1>
          <ChartExportButton targetSelector=".grid.grid-cols-1" fileName="数据统计" />
        </div>

        {/* 日期范围选择 */}
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="date"
            value={range.start}
            onChange={e => setRange(prev => ({ ...prev, start: e.target.value }))}
            className="text-xs rounded-lg px-2 py-1.5"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>~</span>
          <input
            type="date"
            value={range.end}
            onChange={e => setRange(prev => ({ ...prev, end: e.target.value }))}
            className="text-xs rounded-lg px-2 py-1.5"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-20" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-3xl">📈</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有打卡数据，完成第一个任务后这里会出现图表
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="📋 每日计划完成情况" option={chart1Option} />
          <ChartCard title="⏱ 学习/运动/娱乐时间" option={chart2Option} />
          <ChartCard title="🍰 各科目总用时占比" option={chart3Option} />
          <ChartCard title="📊 各科目每日用时对比" option={chart4Option} />
          <div className="lg:col-span-2">
            <ChartCard title="⚖️ 计划用时 vs 实际用时" option={chart5Option} height={Math.max(200, stats.plannedVsActual.length * 50)} />
          </div>
          <ChartCard title="📈 每日完成率趋势" option={chart6Option} />
          <ChartCard title="🎯 科目投入雷达图" option={chart7Option} />
        </div>
      )}
    </div>
  );
}
