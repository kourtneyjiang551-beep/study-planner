'use client';

import { useState } from 'react';
import { ArrowLeft, Plus, Sparkles, Pencil } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import {
  useTemplates,
  createTemplate,
  createTemplateFromPreset,
  deleteTemplate,
  updateTask,
  createTask,
  useSubjects,
  createSubject,
} from '@/lib/db/hooks';
import { PRESET_TEMPLATES } from '@/lib/db/seed';
import TaskForm from '@/components/tasks/TaskForm';
import TemplateCard from '@/components/tasks/TemplateCard';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { Task, RepeatType, SubjectCategory } from '@/types';

export default function TemplatesPage() {
  const { t } = useTheme();
  const { activeChildId } = useActiveChild();
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Task | null>(null);

  const templates = useTemplates(activeChildId);
  const subjects = useSubjects(activeChildId) ?? [];

  const adoptedNames = new Set(
    (templates ?? []).filter(t => t.is_preset).map(t => t.name),
  );
  const availablePresets = PRESET_TEMPLATES.filter(p => !adoptedNames.has(p.name));
  const myTemplates = templates ?? [];

  const handleAddPreset = async (preset: typeof PRESET_TEMPLATES[number]) => {
    await createTemplateFromPreset(activeChildId, preset);
    toast(`已添加「${preset.name}」`, 'success');
  };

  const handleSubmit = async (data: {
    name: string; content?: string; subject_id?: string;
    repeat_type: RepeatType; repeat_days?: number[];
    planned_duration_minutes: number; points_reward: number;
  }) => {
    if (editingTemplate) {
      await updateTask(editingTemplate.id, {
        name: data.name,
        content: data.content,
        subject_id: data.subject_id,
        repeat_type: data.repeat_type,
        repeat_days: data.repeat_days,
        planned_duration_minutes: data.planned_duration_minutes,
        points_reward: data.points_reward,
      });
      setEditingTemplate(null);
      toast('模板已更新', 'success');
    } else {
      await createTemplate(activeChildId, {
        name: data.name,
        content: data.content,
        subject_id: data.subject_id,
        repeat_type: data.repeat_type,
        repeat_days: data.repeat_days,
        planned_duration_minutes: data.planned_duration_minutes,
        points_reward: data.points_reward,
      });
      toast('模板已创建', 'success');
    }
  };

  const handleEdit = (tpl: Task) => {
    setEditingTemplate(tpl);
    setShowForm(true);
  };

  const handleCreateTask = async (tpl: Task) => {
    await createTask(activeChildId, {
      name: tpl.name, content: tpl.content, subject_id: tpl.subject_id,
      repeat_type: tpl.repeat_type, repeat_days: tpl.repeat_days,
      planned_duration_minutes: tpl.planned_duration_minutes,
      planned_time_start: tpl.planned_time_start, planned_time_end: tpl.planned_time_end,
      points_reward: tpl.points_reward,
    });
    toast(`已从「${tpl.name}」创建任务`, 'success');
  };

  const handleDelete = async (tpl: Task) => {
    const ok = await confirm({ title: `确定删除模板「${tpl.name}」？`, danger: true });
    if (ok) {
      await deleteTemplate(tpl.id);
      toast('模板已删除', 'success');
    }
  };

  const handleCreateSubject = async (data: { name: string; color: string; icon: string; category: SubjectCategory }) => {
    return createSubject(activeChildId, data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </a>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('plan')}模板库
          </h1>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setShowForm(true); }}
          className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-1)' }}
        >
          <Plus size={16} />
          创建模板
        </button>
      </div>

      {/* 推荐模板 */}
      {availablePresets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--accent-1)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              推荐模板
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              点击 + 添加到我的模板
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availablePresets.map(preset => (
              <TemplateCard
                key={preset.name}
                name={preset.name}
                content={preset.content}
                repeatType={preset.repeat_type}
                duration={preset.planned_duration_minutes}
                points={preset.points_reward}
                onAdd={() => handleAddPreset(preset)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 我的模板 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          我的模板
          {myTemplates.length > 0 && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
              {myTemplates.length} 个
            </span>
          )}
        </h2>
        {myTemplates.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              还没有模板，可以从上方推荐中添加，或点击右上角创建
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myTemplates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                name={tpl.name}
                content={tpl.content}
                repeatType={tpl.repeat_type}
                duration={tpl.planned_duration_minutes}
                points={tpl.points_reward}
                onEdit={() => handleEdit(tpl)}
                onCreateTask={() => handleCreateTask(tpl)}
                onDelete={() => handleDelete(tpl)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 创建/编辑模板表单 */}
      <TaskForm
        key={`${showForm}-${editingTemplate?.id ?? 'new'}`}
        open={showForm}
        onClose={() => { setShowForm(false); setEditingTemplate(null); }}
        subjects={subjects}
        onSubmit={handleSubmit}
        onCreateSubject={handleCreateSubject}
        editingTask={editingTemplate}
        canSaveTemplate={false}
      />

      {ConfirmDialogEl}
    </div>
  );
}
