'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { useTheme } from '@/components/ThemeProvider';
import { formatDate, formatHours } from '@/lib/utils/date';
import { TrendingUp, Target, Flame, Award, Clock, Zap } from 'lucide-react';

export default function WeeklyReport() {
  const { activeChildId } = useActiveChild();
  const { theme, t } = useTheme();
  const c = theme.colors;

  const today = useMemo(() => formatDate(new Date()), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  }, []);

  // 本周所有记录
  const weekRecords = useLiveQuery(async () => {
    if (!activeChildId) return [];
    // 使用 [child_id+date] 索引查询本周记录
    return db.taskRecords
      .where('[child_id+date]')
      .between([activeChildId, weekAgo], [activeChildId, today])
      .toArray();
  }, [activeChildId, weekAgo, today]);

  // 本周新增勋章
  const newMedals = useLiveQuery(async () => {
    if (!activeChildId) return [];
    return db.medalUnlocks
      .where({ child_id: activeChildId })
      .filter(u => u.unlocked_at >= weekAgo)
      .toArray();
  }, [activeChildId, weekAgo]);

  // 本周积分变动
  const weekPointsLog = useLiveQuery(async () => {
    if (!activeChildId) return [];
    return db.pointsLog
      .where('[child_id+created_at]')
      .between([activeChildId, `${weekAgo}T00:00:00`], [activeChildId, `${today}T23:59:59`])
      .toArray();
  }, [activeChildId, weekAgo, today]);

  // 所有任务（获取 subject 关联）
  const allTasks = useLiveQuery(
    () => db.tasks.where({ child_id: activeChildId }).toArray(),
    [activeChildId],
  );
  const allSubjects = useLiveQuery(
    () => db.subjects.where({ child_id: activeChildId }).toArray(),
    [activeChildId],
  );

  const stats = useMemo(() => {
    const records = weekRecords ?? [];
    const completed = records.filter(r => r.status === 'completed');
    const totalSeconds = records.reduce((s, r) => s + r.actual_duration_seconds, 0);
    const studySeconds = records.reduce((s, r) => {
      if (r.status !== 'completed') return s;
      const task = (allTasks ?? []).find(t => t.id === r.task_id);
      if (!task?.subject_id) return s + r.actual_duration_seconds;
      const subj = (allSubjects ?? []).find(sub => sub.id === task.subject_id);
      if (subj?.category === 'sport') return s;
      if (subj?.category === 'entertainment') return s;
      return s + r.actual_duration_seconds;
    }, 0);
    const sportSeconds = records.reduce((s, r) => {
      if (r.status !== 'completed') return s;
      const task = (allTasks ?? []).find(t => t.id === r.task_id);
      if (!task?.subject_id) return s;
      const subj = (allSubjects ?? []).find(sub => sub.id === task.subject_id);
      if (subj?.category === 'sport') return s + r.actual_duration_seconds;
      return s;
    }, 0);

    const earned = (weekPointsLog ?? []).filter(l => l.type === 'earn').reduce((s, l) => s + l.amount, 0);
    const spent = (weekPointsLog ?? []).filter(l => l.type === 'spend').reduce((s, l) => s + l.amount, 0);

    const dateStrs = new Set(records.map(r => r.date));
    const totalPlanned = records.length;
    const completionRate = totalPlanned > 0 ? Math.round((completed.length / totalPlanned) * 100) : 0;

    return {
      totalTasks: completed.length,
      completionRate,
      studyHours: Math.round(studySeconds / 3600 * 10) / 10,
      sportHours: Math.round(sportSeconds / 3600 * 10) / 10,
      totalHours: formatHours(totalSeconds),
      daysActive: dateStrs.size,
      earned,
      spent,
      netPoints: earned - spent,
      newMedals: (newMedals ?? []).length,
    };
  }, [weekRecords, allTasks, allSubjects, weekPointsLog, newMedals]);

  const items = [
    { icon: <Target size={14} />, label: `完成率`, value: `${stats.completionRate}%`, color: c.accent1 },
    { icon: <Zap size={14} />, label: `完成任务`, value: `${stats.totalTasks} 个`, color: c.accent1 },
    { icon: <Clock size={14} />, label: `学习时长`, value: `${stats.studyHours}h`, color: c.accent3 },
    { icon: <TrendingUp size={14} />, label: `运动时长`, value: `${stats.sportHours}h`, color: c.accent2 },
    { icon: <Flame size={14} />, label: `活跃天数`, value: `${stats.daysActive}/7`, color: c.accent4 },
    { icon: <Award size={14} />, label: `${t('medal')}`, value: `+${stats.newMedals} 枚`, color: c.accent5 },
    { icon: <Zap size={14} />, label: `${t('points')}`, value: `+${stats.earned}`, color: c.accent3 },
    { icon: <Zap size={14} />, label: `消耗`, value: `-${stats.spent}`, color: '#EF4444' },
  ];

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} style={{ color: c.accent1 }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          本周概览
        </h3>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-secondary)' }}>
          {weekAgo.slice(5)} ~ {today.slice(5)}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(item => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: `${item.color}08` }}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
              <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
