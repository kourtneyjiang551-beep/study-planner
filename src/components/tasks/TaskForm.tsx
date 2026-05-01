'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import SubjectSelect from './SubjectSelect';
import type { Task, RepeatType, Subject, SubjectCategory } from '@/types';

const DAY_OPTIONS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
];

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '周一至周五' },
  { value: 'custom', label: '自定义' },
  { value: 'once', label: '仅一次' },
];

type TimeMode = 'duration' | 'range';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSubmit: (data: {
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
  }) => void;
  onCreateSubject: (data: { name: string; color: string; icon: string; category: SubjectCategory }) => Promise<string>;
  /** 编辑模式传入已有任务，或模板预填充数据 */
  editingTask?: Task | null;
  /** 表单标题是否显示"编辑" */
  isEditing?: boolean;
  /** 是否显示"保存为模板"选项 */
  canSaveTemplate?: boolean;
}

export default function TaskForm({
  open,
  onClose,
  subjects,
  onSubmit,
  onCreateSubject,
  editingTask,
  isEditing,
  canSaveTemplate = false,
}: TaskFormProps) {
  const showAsEdit = isEditing ?? !!editingTask;
  const initName = editingTask?.name ?? '';
  const initContent = editingTask?.content ?? '';
  const initSubjectId = editingTask?.subject_id;
  const initRepeatType = editingTask?.repeat_type ?? 'daily';
  const initCustomDays = editingTask?.repeat_days ?? [1, 2, 3, 4, 5];
  const initDuration = editingTask?.planned_duration_minutes ?? 20;
  const initPoints = editingTask?.points_reward ?? 7;
  const hasTimeRange = !!(editingTask?.planned_time_start && editingTask?.planned_time_end);
  const initTimeMode: TimeMode = hasTimeRange ? 'range' : 'duration';
  const initTimeStart = editingTask?.planned_time_start ?? '07:00';
  const initTimeEnd = editingTask?.planned_time_end ?? '07:20';

  const [name, setName] = useState(initName);
  const [content, setContent] = useState(initContent);
  const [subjectId, setSubjectId] = useState<string | undefined>(initSubjectId);
  const [repeatType, setRepeatType] = useState<RepeatType>(initRepeatType);
  const [customDays, setCustomDays] = useState<number[]>(initCustomDays);
  const [duration, setDuration] = useState(initDuration);
  const [points, setPoints] = useState(initPoints);
  const [timeMode, setTimeMode] = useState<TimeMode>(initTimeMode);
  const [timeStart, setTimeStart] = useState(initTimeStart);
  const [timeEnd, setTimeEnd] = useState(initTimeEnd);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (timeMode === 'range' && timeStart >= timeEnd) {
      toast('结束时间必须晚于开始时间', 'error');
      return;
    }
    onSubmit({
      name: name.trim(),
      content: content.trim() || undefined,
      subject_id: subjectId,
      repeat_type: repeatType,
      repeat_days: repeatType === 'custom' ? customDays : undefined,
      planned_duration_minutes: duration,
      planned_time_start: timeMode === 'range' ? timeStart : undefined,
      planned_time_end: timeMode === 'range' ? timeEnd : undefined,
      points_reward: points,
      saveAsTemplate: canSaveTemplate && saveAsTemplate ? true : undefined,
    });
    onClose();
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={showAsEdit ? '编辑任务' : '添加任务'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 任务名称 */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            任务名称 *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如: 晨读"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
            required
            autoFocus
          />
        </div>

        {/* 任务内容描述 */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            内容描述
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 200))}
            placeholder="可选，补充任务细节..."
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={inputStyle}
          />
          <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {content.length}/200
          </p>
        </div>

        {/* 科目选择 */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            科目
          </label>
          <SubjectSelect
            subjects={subjects}
            value={subjectId}
            onChange={setSubjectId}
            onCreateSubject={onCreateSubject}
          />
        </div>

        {/* 重复类型 */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            重复类型 *
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REPEAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRepeatType(opt.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: repeatType === opt.value ? 'var(--accent-1)' : 'var(--bg-secondary)',
                  color: repeatType === opt.value ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: repeatType === opt.value ? 'var(--accent-1)' : 'var(--border)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 自定义星期 */}
        {repeatType === 'custom' && (
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              选择星期
            </label>
            <div className="flex gap-1">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: customDays.includes(d.value) ? 'var(--accent-1)' : 'var(--bg-secondary)',
                    color: customDays.includes(d.value) ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 时长模式切换 */}
        {!editingTask && (
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              时间设置
            </label>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setTimeMode('duration')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: timeMode === 'duration' ? 'var(--accent-1)' : 'var(--bg-secondary)',
                  color: timeMode === 'duration' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: timeMode === 'duration' ? 'var(--accent-1)' : 'var(--border)',
                }}
              >
                固定时长
              </button>
              <button
                type="button"
                onClick={() => setTimeMode('range')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: timeMode === 'range' ? 'var(--accent-1)' : 'var(--bg-secondary)',
                  color: timeMode === 'range' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: timeMode === 'range' ? 'var(--accent-1)' : 'var(--border)',
                }}
              >
                时间段
              </button>
            </div>
          </div>
        )}

        {/* 计划时长 */}
        {timeMode === 'duration' && (
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              计划时长 (分钟) *
            </label>
            <input
              type="number"
              min={1}
              max={240}
              value={duration}
              onChange={e => {
                const v = Math.max(1, parseInt(e.target.value) || 1);
                setDuration(v);
                if (!editingTask) setPoints(Math.max(1, Math.floor(v / 3)));
              }}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {/* 时间段 */}
        {timeMode === 'range' && (
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              时间段 *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeStart}
                onChange={e => setTimeStart(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
                required
              />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>至</span>
              <input
                type="time"
                value={timeEnd}
                onChange={e => setTimeEnd(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
                required
              />
            </div>
          </div>
        )}

        {/* 积分奖励 */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            积分奖励
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={points}
            onChange={e => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* 保存为模板 */}
        {canSaveTemplate && !editingTask && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={e => setSaveAsTemplate(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--accent-1)]"
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>保存为模板</span>
          </label>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-1)' }}
        >
          {showAsEdit ? '保存修改' : '添加任务'}
        </button>
      </form>
    </Modal>
  );
}
