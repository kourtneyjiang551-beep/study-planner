'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Check, SkipForward, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/db/database';
import { now } from '@/lib/utils/id';
import { calculateStreak } from '@/lib/utils/streak';
import { awardPoints } from '@/lib/utils/points';
import { toast } from '@/components/ui/Toast';
import TaskCard from './TaskCard';
import type { Task, Subject, TaskRecord } from '@/types';

interface OverdueSectionProps {
  records: TaskRecord[];
  tasks: Task[];
  subjects: Subject[];
  childId: string;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

export default function OverdueSection({ records, tasks, subjects, childId, onEdit, onDelete }: OverdueSectionProps) {
  const { t } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (records.length === 0) return null;

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const recordIds = new Set(records.map(r => r.id));

  // 按日期分组（最近的在前）
  const byDate = new Map<string, TaskRecord[]>();
  for (const r of records) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(records.map(r => r.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const batchComplete = useCallback(async () => {
    if (selected.size === 0) return;
    let count = 0;
    for (const recordId of selected) {
      const record = records.find(r => r.id === recordId);
      const task = record ? taskMap.get(record.task_id) : null;
      if (!record || !task) continue;

      const earnedPoints = task.points_reward;
      await db.transaction('rw', [db.taskRecords, db.children, db.pointsLog], async () => {
        await db.taskRecords.update(recordId, {
          status: 'completed',
          completed_at: now(),
          is_manual_complete: true,
          actual_duration_seconds: 0,
          updated_at: now(),
        });
        if (earnedPoints > 0) {
          const child = await db.children.get(childId);
          if (child) {
            await db.children.update(childId, {
              current_points: child.current_points + earnedPoints,
              updated_at: now(),
            });
            await db.pointsLog.add({
              id: crypto.randomUUID(),
              child_id: childId,
              amount: earnedPoints,
              type: 'earn',
              source: 'task_complete',
              source_id: recordId,
              description: `完成${t('task')}获得 ${earnedPoints} 积分`,
              created_at: now(),
            });
          }
        }
      });
      count++;
    }
    await calculateStreak(childId);
    toast(`已补打卡 ${count} 个${t('task')}`, 'success');
    setSelected(new Set());
    setBatchMode(false);
  }, [selected, records, taskMap, childId, t]);

  const batchSkip = useCallback(async () => {
    if (selected.size === 0) return;
    const ts = now();
    for (const recordId of selected) {
      await db.taskRecords.update(recordId, {
        status: 'skipped',
        updated_at: ts,
      });
    }
    toast(`已跳过 ${selected.size} 个${t('task')}`, 'success');
    setSelected(new Set());
    setBatchMode(false);
  }, [selected, t]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-black/5"
      >
        <AlertTriangle size={16} style={{ color: 'var(--accent-2)' }} />
        <span className="flex-1 text-left text-sm font-medium" style={{ color: 'var(--accent-2)' }}>
          逾期任务 ({records.length})
        </span>
        {isExpanded ? (
          <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-3 px-4 pb-4">
          {/* 批量操作栏 */}
          <div className="flex items-center gap-2">
            {batchMode ? (
              <>
                <button
                  onClick={selectAll}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  全选
                </button>
                <button
                  onClick={batchComplete}
                  disabled={selected.size === 0}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-3)' }}
                >
                  <Check size={12} /> 补打卡 ({selected.size})
                </button>
                <button
                  onClick={batchSkip}
                  disabled={selected.size === 0}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <SkipForward size={12} /> 跳过 ({selected.size})
                </button>
                <button
                  onClick={() => { setBatchMode(false); clearSelection(); }}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg ml-auto"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setBatchMode(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                批量操作
              </button>
            )}
          </div>

          {sortedDates.map(date => {
            const dateRecords = byDate.get(date) ?? [];
            const dateObj = new Date(date + 'T00:00:00');
            const label = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

            return (
              <div key={date}>
                <div className="mb-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </div>
                <div className="space-y-1.5">
                  {dateRecords.map(record => {
                    const task = taskMap.get(record.task_id);
                    if (!task) return null;
                    const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
                    return (
                      <div key={record.id} className="flex gap-2 items-start">
                        {batchMode && (
                          <label className="flex items-center mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.has(record.id)}
                              onChange={() => toggleSelect(record.id)}
                              className="accent-[var(--accent-1)]"
                            />
                          </label>
                        )}
                        <div className="flex-1 min-w-0">
                          <TaskCard
                            task={task}
                            subject={subject}
                            record={record}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
