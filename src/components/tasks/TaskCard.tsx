'use client';

import { Clock, Pencil, Trash2 } from 'lucide-react';
import { useTimer } from '@/lib/hooks/useTimer';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { TimerControls } from '@/components/timer/TimerControls';
import { formatDuration } from '@/lib/utils/date';
import type { Task, Subject, TaskRecord } from '@/types';

const REPEAT_LABELS: Record<string, string> = {
  daily: '每天',
  weekdays: '周一至周五',
  once: '仅一次',
  custom: '自定义',
};

interface TaskCardProps {
  task: Task;
  subject?: Subject;
  record?: TaskRecord;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

/** 有 record 时渲染带计时器的卡片 */
function TaskCardWithTimer({
  task,
  subject,
  record,
  onEdit,
  onDelete,
}: TaskCardProps & { record: TaskRecord }) {
  const timer = useTimer(record.id);
  const isCompleted = record.status === 'completed';
  const isSkipped = record.status === 'skipped';
  const isActive = record.status === 'in_progress';

  return (
    <div
      className="flex overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: isActive ? '1.5px solid var(--accent-1)' : '1px solid var(--border)',
        opacity: isCompleted || isSkipped ? 0.6 : 1,
      }}
    >
      {/* 科目色条 */}
      <div
        className="w-1.5 flex-shrink-0"
        style={{ backgroundColor: subject?.color ?? 'var(--accent-3)' }}
      />

      <div className="flex-1 px-3 py-3">
        <div className="flex items-center gap-3">
          {/* 科目图标 */}
          <div className="flex-shrink-0 text-lg">{subject?.icon ?? '📋'}</div>

          {/* 任务信息 */}
          <div className="min-w-0 flex-1">
            <span
              className="truncate text-sm font-medium"
              style={{
                color: 'var(--text-primary)',
                textDecoration: isCompleted ? 'line-through' : 'none',
              }}
            >
              {task.name}
            </span>
            {task.content && (
              <p className="mt-0.5 text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                {task.content}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: 'var(--accent-1)', color: '#fff', opacity: 0.8 }}
              >
                {REPEAT_LABELS[task.repeat_type] ?? task.repeat_type}
              </span>
              <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Clock size={12} />
                {task.planned_time_start && task.planned_time_end
                  ? `${task.planned_time_start}-${task.planned_time_end}`
                  : `${task.planned_duration_minutes}分钟`}
              </span>
              {subject && (
                <span className="text-xs" style={{ color: subject.color }}>{subject.name}</span>
              )}
              {task.points_reward > 0 && (
                <span className="text-[10px]" style={{ color: 'var(--accent-1)' }}>
                  +{task.points_reward}分
                </span>
              )}
            </div>
          </div>

          {/* 状态/计时显示 */}
          <div className="flex-shrink-0 text-right">
            {isCompleted ? (
              <div className="flex flex-col items-end">
                <span className="text-xs" style={{ color: 'var(--accent-3, #22c55e)' }}>✅ 已完成</span>
                {record.actual_duration_seconds > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {formatDuration(record.actual_duration_seconds)}
                  </span>
                )}
              </div>
            ) : isSkipped ? (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>⏭ 已跳过</span>
            ) : (
              <TimerDisplay
                seconds={timer.displaySeconds}
                isActive={isActive}
                isAbnormal={timer.isAbnormal}
              />
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {onEdit && !isCompleted && !isSkipped && (
              <button
                onClick={() => onEdit(task)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 active:scale-95"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="编辑任务"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && !isCompleted && !isSkipped && (
              <button
                onClick={() => onDelete(task.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-red-50 active:scale-95"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="删除任务"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 计时器控制（仅未完成时显示） */}
        {!isCompleted && !isSkipped && (
          <div className="mt-2 pl-9 flex items-center gap-2">
            <TimerControls
              status={record.status}
              hasDuration={record.actual_duration_seconds > 0}
              onStart={timer.start}
              onPause={timer.pause}
              onComplete={timer.complete}
              onManualComplete={timer.manualComplete}
            />
            {record.status !== 'in_progress' && (
              <button
                onClick={timer.skip}
                className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                ⏭ 跳过
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 无 record 时的简化卡片（不应出现，但安全兜底） */
export default function TaskCard({ task, subject, record, onEdit, onDelete }: TaskCardProps) {
  if (record) {
    return (
      <TaskCardWithTimer
        task={task}
        subject={subject}
        record={record}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  // 兜底：无 record
  return (
    <div
      className="flex overflow-hidden rounded-xl"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: subject?.color ?? 'var(--accent-3)' }} />
      <div className="flex flex-1 items-center gap-3 px-3 py-3">
        <div className="flex-shrink-0 text-lg">{subject?.icon ?? '📋'}</div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.name}</span>
          {task.content && (
            <p className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{task.content}</p>
          )}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded-md px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--accent-1)', color: '#fff', opacity: 0.8 }}>
              {REPEAT_LABELS[task.repeat_type] ?? task.repeat_type}
            </span>
            <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Clock size={12} />{task.planned_duration_minutes}分钟
            </span>
          </div>
        </div>
        {onEdit && (
          <button onClick={() => onEdit(task)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5" style={{ color: 'var(--text-secondary)' }} aria-label="编辑任务">
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(task.id)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-50" style={{ color: 'var(--text-secondary)' }} aria-label="删除任务">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
