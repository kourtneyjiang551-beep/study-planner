'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Rocket, Clock, Bell, X } from 'lucide-react';
import { db } from '@/lib/db/database';
import {
  useSubjects,
  useActiveTasks,
  useTaskRecords,
  useOverdueRecords,
  createTask,
  createSubject,
  createTemplate,
  updateTask,
  deleteTask,
  ensureTaskRecordsForDate,
} from '@/lib/db/hooks';
import { today } from '@/lib/utils/date';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import WeekView from '@/components/tasks/WeekView';
import TaskList from '@/components/tasks/TaskList';
import TaskForm from '@/components/tasks/TaskForm';
import OverdueSection from '@/components/tasks/OverdueSection';
import TemplatePicker from '@/components/tasks/TemplatePicker';
import WeeklyReport from '@/components/stats/WeeklyReport';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Task, RepeatType, SubjectCategory } from '@/types';

export default function DashboardPage() {
  const { theme, t } = useTheme();
  const { activeChildId, isLoading } = useActiveChild();
  const todayStr = today();

  // 周视图状态
  const [weekBaseDate, setWeekBaseDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // 任务表单状态
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [templatePreFill, setTemplatePreFill] = useState<Task | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // 确保选中日期的 task_records 已生成
  useEffect(() => {
    if (activeChildId) {
      ensureTaskRecordsForDate(activeChildId, selectedDate);
    }
  }, [activeChildId, selectedDate]);

  // 数据查询
  const subjects = useSubjects(activeChildId);
  const tasks = useActiveTasks(activeChildId);
  const records = useTaskRecords(activeChildId, selectedDate);
  const overdueRecords = useOverdueRecords(activeChildId, todayStr);

  // 加载中的所有任务（用于逾期区域显示任务名称）
  const allTasks = useLiveQuery(
    () => db.tasks.where({ child_id: activeChildId }).toArray(),
    [activeChildId],
  );

  // 周导航
  const handlePrevWeek = useCallback(() => {
    setWeekBaseDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekBaseDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  // 筛选当天应显示的任务
  const filteredTasks = (tasks ?? []).filter(task => {
    const dayOfWeek = new Date(selectedDate + 'T00:00:00').getDay();
    const dow = dayOfWeek === 0 ? 7 : dayOfWeek;

    if (task.repeat_type === 'once') {
      return task.created_at.slice(0, 10) === selectedDate;
    }
    return (task.repeat_days ?? []).includes(dow);
  });

  // 处理添加任务
  const handleAddTask = async (data: {
    name: string;
    content?: string;
    subject_id?: string;
    repeat_type: RepeatType;
    repeat_days?: number[];
    planned_duration_minutes: number;
    planned_time_start?: string;
    planned_time_end?: string;
    points_reward: number;
    saveAsTemplate?: boolean;
  }) => {
    const taskId = await createTask(activeChildId, {
      name: data.name,
      content: data.content,
      subject_id: data.subject_id,
      repeat_type: data.repeat_type,
      repeat_days: data.repeat_days,
      planned_duration_minutes: data.planned_duration_minutes,
      planned_time_start: data.planned_time_start,
      planned_time_end: data.planned_time_end,
      points_reward: data.points_reward,
    });
    // 保存为模板
    if (data.saveAsTemplate) {
      await createTemplate(activeChildId, {
        name: data.name,
        content: data.content,
        subject_id: data.subject_id,
        repeat_type: data.repeat_type,
        repeat_days: data.repeat_days,
        planned_duration_minutes: data.planned_duration_minutes,
        planned_time_start: data.planned_time_start,
        planned_time_end: data.planned_time_end,
        points_reward: data.points_reward,
      });
    }
    // 重新生成 task_records
    await ensureTaskRecordsForDate(activeChildId, selectedDate);
    return taskId;
  };

  // 处理编辑任务
  const handleEditTask = async (data: {
    name: string;
    content?: string;
    subject_id?: string;
    repeat_type: RepeatType;
    repeat_days?: number[];
    planned_duration_minutes: number;
    planned_time_start?: string;
    planned_time_end?: string;
    points_reward: number;
  }) => {
    if (!editingTask) return;
    await updateTask(editingTask.id, {
      name: data.name,
      content: data.content,
      subject_id: data.subject_id,
      repeat_type: data.repeat_type,
      repeat_days: data.repeat_days,
      planned_duration_minutes: data.planned_duration_minutes,
      planned_time_start: data.planned_time_start,
      planned_time_end: data.planned_time_end,
      points_reward: data.points_reward,
    });
  };

  // 处理创建科目
  const handleCreateSubject = async (data: {
    name: string;
    color: string;
    icon: string;
    category: SubjectCategory;
  }) => {
    return await createSubject(activeChildId, data);
  };

  // 处理删除任务（带确认）
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const handleDeleteTask = async (taskId: string) => {
    const ok = await confirm({ title: '确定删除这个任务？', danger: true });
    if (!ok) return;
    await deleteTask(taskId);
  };

  if (isLoading || !activeChildId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  const isEmpty = filteredTasks.length === 0;

  // 今日时间线提醒：有计划时间的未完成任务
  const [showTimeline, setShowTimeline] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const upcomingTasks = useMemo(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return filteredTasks
      .filter(t => {
        if (!t.planned_time_start || t.repeat_type === 'once') return false;
        const [h, m] = t.planned_time_start.split(':').map(Number);
        const taskMinutes = h * 60 + m;
        // 在未来 30 分钟内要开始的任务
        return taskMinutes > currentMinutes && taskMinutes - currentMinutes <= 30;
      })
      .sort((a, b) => (a.planned_time_start ?? '').localeCompare(b.planned_time_start ?? ''));
  }, [filteredTasks, now]);

  useEffect(() => {
    setShowTimeline(upcomingTasks.length > 0);
  }, [upcomingTasks.length]);

  return (
    <div className="space-y-4">
      {ConfirmDialogEl}

      {/* 周视图 */}
      <WeekView
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        weekBaseDate={weekBaseDate}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
      />

      {/* 本周概览 */}
      <WeeklyReport />

      {/* 时间线提醒 */}
      {showTimeline && upcomingTasks.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: `${theme.colors.accent2}12`, border: `1px solid ${theme.colors.accent2}30` }}
        >
          <Bell size={16} style={{ color: 'var(--accent-2)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>即将开始</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {upcomingTasks.map(t => {
                const subj = t.subject_id ? (subjects ?? []).find(s => s.id === t.subject_id) : null;
                return (
                  <span
                    key={t.id}
                    className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{
                      backgroundColor: subj ? `${subj.color}15` : 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Clock size={9} />
                    {t.planned_time_start} {subj?.icon} {t.name}
                  </span>
                );
              })}
            </div>
          </div>
          <button onClick={() => setShowTimeline(false)} className="p-1" style={{ color: 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 逾期任务 */}
      {overdueRecords && overdueRecords.length > 0 && (
        <OverdueSection
          records={overdueRecords}
          tasks={allTasks ?? []}
          subjects={subjects ?? []}
          childId={activeChildId}
          onEdit={task => { setEditingTask(task); setShowTaskForm(true); }}
          onDelete={handleDeleteTask}
        />
      )}

      {/* 任务列表或空状态 */}
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-2xl py-16"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--accent-3)', opacity: 0.15 }}
          >
            <Rocket size={32} style={{ color: 'var(--accent-3)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有学习{t('task')}，开始规划你的{t('plan')}吧！
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              📋 从模板创建
            </button>
            <button
              onClick={() => {
                setEditingTask(null);
                setShowTaskForm(true);
              }}
              className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              <Plus size={16} />
              添加{t('task')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 添加按钮 */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              📋 从模板创建
            </button>
            <button
              onClick={() => {
                setEditingTask(null);
                setShowTaskForm(true);
              }}
              className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              <Plus size={16} />
              添加{t('task')}
            </button>
          </div>

          <TaskList
            tasks={filteredTasks}
            subjects={subjects ?? []}
            records={records ?? []}
            onEditTask={task => {
              setEditingTask(task);
              setShowTaskForm(true);
            }}
            onDeleteTask={handleDeleteTask}
          />
        </>
      )}

      {/* 任务表单弹窗 */}
      <TaskForm
        key={`${showTaskForm}-${editingTask?.id ?? templatePreFill?.id ?? 'new'}`}
        open={showTaskForm}
        onClose={() => {
          setShowTaskForm(false);
          setEditingTask(null);
          setTemplatePreFill(null);
        }}
        subjects={subjects ?? []}
        onSubmit={editingTask ? handleEditTask : handleAddTask}
        onCreateSubject={handleCreateSubject}
        editingTask={editingTask ?? templatePreFill}
        isEditing={!!editingTask}
        canSaveTemplate={!editingTask && !templatePreFill}
      />

      {/* 模板选取器 */}
      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onApply={(tpl) => {
          setEditingTask(null);
          setTemplatePreFill(tpl);
          setShowTaskForm(true);
        }}
      />
    </div>
  );
}
