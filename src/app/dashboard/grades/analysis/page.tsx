'use client';

import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useTheme } from '@/components/ThemeProvider';
import { useSubjects } from '@/lib/db/hooks';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import ChartCard from '@/components/charts/ChartCard';
import { useChartBase } from '@/components/charts/useChartTheme';
import ChartExportButton from '@/components/charts/ChartExportButton';

function getRatingLabel(score: number, total: number) {
  const pct = (score / total) * 100;
  if (pct >= 100) return '学神';
  if (pct >= 95) return '完美';
  if (pct >= 85) return '优秀';
  if (pct >= 70) return '良好';
  return '加油';
}

export default function GradeAnalysisPage() {
  const { theme } = useTheme();
  const { activeChildId } = useActiveChild();
  const colors = theme.colors;
  const subjects = useSubjects(activeChildId);
  const base = useChartBase();

  const grades = useLiveQuery(
    () => db.grades.where({ child_id: activeChildId }).sortBy('exam_date'),
    [activeChildId],
  );

  const subjectMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const s of subjects ?? []) m.set(s.id, { name: s.name, color: s.color });
    return m;
  }, [subjects]);

  // 按科目分组
  const gradesBySubject = useMemo(() => {
    const map = new Map<string, typeof grades>();
    for (const g of grades ?? []) {
      const sid = g.subject_id ?? '__none__';
      const arr = map.get(sid) ?? [];
      arr.push(g);
      map.set(sid, arr);
    }
    return map;
  }, [grades]);

  const subjectIds = useMemo(() => [...gradesBySubject.keys()], [gradesBySubject]);

  // 图表 1: 各科目成绩趋势（多折线）
  const chart1Option = useMemo(() => {
    const allDates = [...new Set((grades ?? []).map(g => g.exam_date))].sort();
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' as const },
      legend: { ...base.legend, data: subjectIds.map(sid => subjectMap.get(sid)?.name ?? '未分类'), top: 0, type: 'scroll' as const },
      xAxis: { type: 'category' as const, data: allDates, axisLabel: { ...base.axisLabel, fontSize: 10 } },
      yAxis: { type: 'value' as const, axisLabel: base.axisLabel },
      series: subjectIds.map(sid => {
        const gs = gradesBySubject.get(sid) ?? [];
        const info = subjectMap.get(sid);
        const dateScoreMap = new Map(gs.map(g => [g.exam_date, g.score]));
        return {
          name: info?.name ?? '未分类', type: 'line',
          data: allDates.map(d => dateScoreMap.get(d) ?? null),
          connectNulls: true, smooth: true,
          itemStyle: { color: info?.color ?? '#888' }, lineStyle: { width: 2 },
        };
      }),
    };
  }, [base, grades, gradesBySubject, subjectIds, subjectMap]);

  // 图表 2: 各科目平均得分率（雷达图）
  const chart2Option = useMemo(() => {
    const indicators = subjectIds.map(sid => ({ name: subjectMap.get(sid)?.name ?? '未分类', max: 100 }));
    const values = subjectIds.map(sid => {
      const gs = gradesBySubject.get(sid) ?? [];
      if (gs.length === 0) return 0;
      return Math.round(gs.reduce((sum, g) => sum + (g.score / g.total_score) * 100, 0) / gs.length);
    });
    return {
      ...base,
      radar: {
        indicator: indicators, shape: 'polygon' as const,
        axisName: { color: colors.textSecondary, fontSize: 10 },
        splitArea: base.splitArea, splitLine: base.splitLine, axisLine: base.axisLine,
      },
      series: [{
        type: 'radar',
        data: [{ value: values, areaStyle: { color: `${colors.accent3}30` }, lineStyle: { color: colors.accent3 }, itemStyle: { color: colors.accent3 } }],
      }],
    };
  }, [base, gradesBySubject, subjectIds, subjectMap, colors]);

  // 图表 3: 目标与实际差距（水平条形）
  const targetGradeCount = (grades ?? []).filter(g => g.target_score != null).length;
  const chart3Option = useMemo(() => {
    const withTarget = (grades ?? []).filter(g => g.target_score != null);
    const names = withTarget.map(g => `${subjectMap.get(g.subject_id ?? '')?.name ?? ''} ${g.exam_name}`.trim());
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' as const },
      legend: { ...base.legend, data: ['目标分', '实际分'], top: 0 },
      grid: { left: 100, right: 20, top: 30, bottom: 10 },
      xAxis: { type: 'value' as const, axisLabel: base.axisLabel },
      yAxis: { type: 'category' as const, data: names, axisLabel: { ...base.axisLabel, fontSize: 10, width: 80, overflow: 'truncate' as const } },
      series: [
        { name: '目标分', type: 'bar', data: withTarget.map(g => g.target_score), itemStyle: { color: colors.accent3, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 14 },
        { name: '实际分', type: 'bar', data: withTarget.map(g => g.score), itemStyle: { color: colors.accent1, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 14 },
      ],
    };
  }, [base, grades, subjectMap, colors]);

  // 图表 4: 排名变化趋势（折线，Y 轴反转）
  const withRank = (grades ?? []).filter(g => g.class_rank != null || g.grade_rank != null);
  const chart4Option = useMemo(() => {
    const dates = withRank.map(g => g.exam_date);
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' as const },
      legend: { ...base.legend, data: ['班级排名', '年级排名'], top: 0 },
      xAxis: { type: 'category' as const, data: dates, axisLabel: { ...base.axisLabel, fontSize: 10 } },
      yAxis: { type: 'value' as const, inverse: true, minInterval: 1, axisLabel: base.axisLabel },
      series: [
        { name: '班级排名', type: 'line', data: withRank.map(g => g.class_rank ?? null), smooth: true, itemStyle: { color: colors.accent1 }, lineStyle: { width: 2 } },
        { name: '年级排名', type: 'line', data: withRank.map(g => g.grade_rank ?? null), smooth: true, itemStyle: { color: colors.accent5 }, lineStyle: { width: 2 } },
      ],
    };
  }, [base, withRank, colors]);

  // 图表 5: 成绩位置直方图（班级最高 vs 我 vs 平均）
  const withClassData = (grades ?? []).filter(g => g.class_avg != null || g.class_max != null);
  const chart5Option = useMemo(() => {
    const names = withClassData.map(g => `${subjectMap.get(g.subject_id ?? '')?.name ?? ''} ${g.exam_name}`.trim());
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' as const },
      legend: { ...base.legend, data: ['班级最高', '我的成绩', '班级平均'], top: 0 },
      grid: { ...base.grid, top: 30 },
      xAxis: { type: 'category' as const, data: names, axisLabel: { ...base.axisLabel, fontSize: 9, rotate: 30 } },
      yAxis: { type: 'value' as const, axisLabel: base.axisLabel },
      series: [
        { name: '班级最高', type: 'bar', data: withClassData.map(g => g.class_max ?? null), itemStyle: { color: colors.accent2, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16 },
        { name: '我的成绩', type: 'bar', data: withClassData.map(g => g.score), itemStyle: { color: colors.accent1, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16 },
        { name: '班级平均', type: 'bar', data: withClassData.map(g => g.class_avg ?? null), itemStyle: { color: colors.accent3, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16 },
      ],
    };
  }, [base, withClassData, subjectMap, colors]);

  // 图表 6: 薄弱环节分析（雷达 — 子项得分）
  const withSubScores = (grades ?? []).filter(g => g.sub_scores && g.sub_scores.length > 0);
  const chart6Option = useMemo(() => {
    const blockScores = new Map<string, { total: number; sum: number }>();
    for (const g of withSubScores) {
      for (const ss of g.sub_scores!) {
        const prev = blockScores.get(ss.name) ?? { total: 0, sum: 0 };
        prev.sum += ss.score;
        prev.total += ss.total;
        blockScores.set(ss.name, prev);
      }
    }
    const blocks = [...blockScores.entries()];
    return {
      ...base,
      radar: {
        indicator: blocks.map(([name]) => ({ name, max: 100 })),
        shape: 'polygon' as const,
        axisName: { color: colors.textSecondary, fontSize: 10 },
        splitArea: base.splitArea, splitLine: base.splitLine, axisLine: base.axisLine,
      },
      series: [{
        type: 'radar',
        data: [{ value: blocks.map(([, v]) => Math.round((v.sum / v.total) * 100)), areaStyle: { color: `${colors.accent4}30` }, lineStyle: { color: colors.accent4 }, itemStyle: { color: colors.accent4 } }],
      }],
    };
  }, [base, withSubScores, colors]);

  // 图表 7: 考试表现分析（饼图 — 按评级分类）
  const chart7Option = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grades ?? []) {
      const label = getRatingLabel(g.score, g.total_score);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const ratingColors: Record<string, string> = { '学神': '#22c55e', '完美': '#3b82f6', '优秀': '#a855f7', '良好': '#f97316', '加油': '#888888' };
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'item' as const },
      series: [{
        type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
        data: [...counts.entries()].map(([name, value]) => ({ name, value, itemStyle: { color: ratingColors[name] ?? '#888' } })),
        label: { color: colors.textSecondary, fontSize: 11, formatter: '{b}: {c}次 ({d}%)' },
      }],
    };
  }, [base, grades, colors]);

  const hasData = (grades ?? []).length > 0;

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <a href="/dashboard/grades" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
        </a>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          📊 成绩分析
        </h1>
        <ChartExportButton targetSelector=".grid.grid-cols-1" fileName="成绩分析" />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-20" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-3xl">📊</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有成绩数据，添加考试成绩后这里会出现分析图表
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="📈 各科目成绩趋势" option={chart1Option} />

          <ChartCard title="🎯 各科目平均得分率" option={chart2Option} />

          {(grades ?? []).some(g => g.target_score != null) && (
            <ChartCard title="⚖️ 目标与实际差距" option={chart3Option} height={Math.max(200, targetGradeCount * 40)} />
          )}

          {withRank.length > 0 && (
            <ChartCard title="🏅 排名变化趋势" option={chart4Option} />
          )}

          {withClassData.length > 0 && (
            <ChartCard title="📊 成绩位置对比" option={chart5Option} />
          )}

          {withSubScores.length > 0 && (
            <ChartCard title="🔍 薄弱环节分析" option={chart6Option} />
          )}

          <ChartCard title="🏆 考试表现分析" option={chart7Option} />
        </div>
      )}
    </div>
  );
}
