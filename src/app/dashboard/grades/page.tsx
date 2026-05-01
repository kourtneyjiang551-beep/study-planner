'use client';

import { useState } from 'react';
import { Plus, ArrowLeft, BarChart3 } from 'lucide-react';
import {
  useSubjects,
  useGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  type GradeFilters,
} from '@/lib/db/hooks';
import Select from '@/components/ui/Select';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import GradeCard from '@/components/grades/GradeCard';
import GradeForm, { EXAM_TYPES, GRADE_LEVELS, SEMESTERS } from '@/components/grades/GradeForm';
import type { Grade } from '@/types';

export default function GradesPage() {
  const { activeChildId } = useActiveChild();
  const subjects = useSubjects(activeChildId);
  const [filters, setFilters] = useState<GradeFilters>({});
  const grades = useGrades(activeChildId, filters);
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  // 构建 subject 查找表
  const subjectMap = new Map<string, { name: string; color: string }>();
  for (const s of subjects ?? []) subjectMap.set(s.id, { name: s.name, color: s.color });

  const handleSubmit = async (data: Omit<Grade, 'id' | 'child_id' | 'created_at' | 'updated_at'>) => {
    if (editingGrade) {
      await updateGrade(editingGrade.id, data);
    } else {
      await createGrade(activeChildId, data);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: '确定删除这条成绩记录？', danger: true });
    if (!ok) return;
    await deleteGrade(id);
  };

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </a>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            📈 成绩追踪
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/grades/analysis"
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <BarChart3 size={14} />
            分析
          </a>
          <button
            onClick={() => { setEditingGrade(null); setShowForm(true); }}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-1)' }}
          >
            <Plus size={16} />
            添加成绩
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-2 flex-wrap items-center overflow-x-auto scrollbar-hide">
        <Select
          size="sm"
          value={filters.subject_id ?? ''}
          onValueChange={v => setFilters(f => ({ ...f, subject_id: v || undefined }))}
          placeholder="科目"
          clearable
          clearLabel="全部科目"
          options={(subjects ?? []).map(s => ({ value: s.id, label: s.name }))}
          inline
        />
        <Select
          size="sm"
          value={filters.exam_type ?? ''}
          onValueChange={v => setFilters(f => ({ ...f, exam_type: v || undefined }))}
          placeholder="类型"
          clearable
          clearLabel="全部类型"
          options={EXAM_TYPES.map(t => ({ value: t, label: t }))}
          inline
        />
        <Select
          size="sm"
          value={filters.grade_level ?? ''}
          onValueChange={v => setFilters(f => ({ ...f, grade_level: v || undefined }))}
          placeholder="年级"
          clearable
          clearLabel="全部年级"
          options={GRADE_LEVELS.map(g => ({ value: g, label: g }))}
          inline
        />
        <Select
          size="sm"
          value={filters.semester ?? ''}
          onValueChange={v => setFilters(f => ({ ...f, semester: v || undefined }))}
          placeholder="学期"
          clearable
          clearLabel="全部学期"
          options={SEMESTERS.map(s => ({ value: s, label: s }))}
          inline
        />
        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setFilters({})}
            className="text-xs px-2 py-1 rounded-full transition-colors"
            style={{ color: 'var(--accent-1)', backgroundColor: 'var(--accent-1)10' }}
          >
            重置
          </button>
        )}
      </div>

      {/* 成绩列表 */}
      {(!grades || grades.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-3xl">📝</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有成绩记录，添加第一次考试成绩吧
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {grades.map(g => {
            const subject = g.subject_id ? subjectMap.get(g.subject_id) : null;
            return (
              <GradeCard
                key={g.id}
                grade={g}
                subjectName={subject?.name ?? '未分类'}
                subjectColor={subject?.color ?? '#888'}
                onEdit={() => { setEditingGrade(g); setShowForm(true); }}
                onDelete={() => handleDelete(g.id)}
              />
            );
          })}
        </div>
      )}

      {/* 表单弹窗 */}
      <GradeForm
        key={`${showForm}-${editingGrade?.id ?? 'new'}`}
        open={showForm}
        onClose={() => { setShowForm(false); setEditingGrade(null); }}
        subjects={(subjects ?? []).map(s => ({ id: s.id, name: s.name, color: s.color }))}
        editingGrade={editingGrade}
        onSubmit={handleSubmit}
      />
      {ConfirmDialogEl}
    </div>
  );
}
