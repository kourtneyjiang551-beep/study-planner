'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import type { Grade, SubScore } from '@/types';

export const EXAM_TYPES = ['单元测验', '月考', '期中考试', '期末考试', '模拟考', '其他'];
export const GRADE_LEVELS = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];
export const SEMESTERS = ['上学期', '下学期'];

export default function GradeForm({
  open,
  onClose,
  subjects,
  editingGrade,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  subjects: { id: string; name: string; color: string }[];
  editingGrade: Grade | null;
  onSubmit: (data: Omit<Grade, 'id' | 'child_id' | 'created_at' | 'updated_at'>) => void;
}) {
  const [subScores, setSubScores] = useState<SubScore[]>(editingGrade?.sub_scores ?? []);
  const [showSubScores, setShowSubScores] = useState((editingGrade?.sub_scores?.length ?? 0) > 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => {
      const v = fd.get(k) as string;
      return v ? Number(v) : undefined;
    };

    const score = Number(get('score'));
    const totalScore = Number(get('total_score'));
    const targetScore = getNum('target_score');

    if (totalScore <= 0) { toast('满分必须大于 0', 'error'); return; }
    if (score < 0 || score > totalScore) { toast(`得分应在 0 ~ ${totalScore} 之间`, 'error'); return; }
    if (targetScore !== undefined && (targetScore < 0 || targetScore > totalScore)) {
      toast(`目标分应在 0 ~ ${totalScore} 之间`, 'error'); return;
    }

    onSubmit({
      subject_id: get('subject_id') || undefined,
      exam_name: get('exam_name'),
      exam_type: get('exam_type'),
      exam_date: get('exam_date'),
      score: Number(get('score')),
      total_score: Number(get('total_score')),
      target_score: getNum('target_score'),
      class_avg: getNum('class_avg'),
      class_max: getNum('class_max'),
      class_rank: getNum('class_rank'),
      grade_rank: getNum('grade_rank'),
      semester: get('semester'),
      grade_level: get('grade_level'),
      sub_scores: showSubScores && subScores.length > 0 ? subScores : undefined,
    });
    onClose();
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  return (
    <Modal
      open={open}
      onOpenChange={v => { if (!v) onClose(); }}
      title={editingGrade ? '编辑成绩' : '添加成绩'}
    >
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        <input
          name="exam_name"
          required
          placeholder="考试名称"
          defaultValue={editingGrade?.exam_name}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={inputStyle}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            name="subject_id"
            defaultValue={editingGrade?.subject_id ?? ''}
            placeholder="选择科目"
            options={subjects.map(s => ({ value: s.id, label: s.name }))}
          />
          <Select
            name="exam_type"
            required
            defaultValue={editingGrade?.exam_type ?? ''}
            placeholder="考试类型"
            options={EXAM_TYPES.map(t => ({ value: t, label: t }))}
          />
        </div>
        <input
          name="exam_date"
          type="date"
          required
          defaultValue={editingGrade?.exam_date}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={inputStyle}
        />
        <div className="grid grid-cols-3 gap-2">
          <input name="score" type="number" required min="0" placeholder="得分" defaultValue={editingGrade?.score} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="total_score" type="number" required min="1" placeholder="满分" defaultValue={editingGrade?.total_score ?? 100} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="target_score" type="number" min="0" placeholder="目标分" defaultValue={editingGrade?.target_score ?? ''} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="class_avg" type="number" step="0.1" placeholder="班级平均" defaultValue={editingGrade?.class_avg ?? ''} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="class_max" type="number" placeholder="班级最高" defaultValue={editingGrade?.class_max ?? ''} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="class_rank" type="number" placeholder="班级排名" defaultValue={editingGrade?.class_rank ?? ''} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="grade_rank" type="number" placeholder="年级排名" defaultValue={editingGrade?.grade_rank ?? ''} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            name="grade_level"
            required
            defaultValue={editingGrade?.grade_level ?? ''}
            placeholder="年级"
            options={GRADE_LEVELS.map(g => ({ value: g, label: g }))}
          />
          <Select
            name="semester"
            required
            defaultValue={editingGrade?.semester ?? ''}
            placeholder="学期"
            options={SEMESTERS.map(s => ({ value: s, label: s }))}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowSubScores(!showSubScores)}
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {showSubScores ? '▾ 收起子项得分' : '▸ 添加子项得分（选填）'}
          </button>
          {showSubScores && (
            <div className="mt-2 space-y-2">
              {subScores.map((ss, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    placeholder="板块名"
                    value={ss.name}
                    onChange={e => {
                      const next = [...subScores];
                      next[i] = { ...ss, name: e.target.value };
                      setSubScores(next);
                    }}
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="得分"
                    value={ss.score || ''}
                    onChange={e => {
                      const next = [...subScores];
                      next[i] = { ...ss, score: Number(e.target.value) };
                      setSubScores(next);
                    }}
                    className="w-16 rounded-lg px-2 py-1.5 text-xs"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="满分"
                    value={ss.total || ''}
                    onChange={e => {
                      const next = [...subScores];
                      next[i] = { ...ss, total: Number(e.target.value) };
                      setSubScores(next);
                    }}
                    className="w-16 rounded-lg px-2 py-1.5 text-xs"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setSubScores(subScores.filter((_, j) => j !== i))}
                    className="text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="删除子项"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSubScores([...subScores, { name: '', score: 0, total: 0 }])}
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                + 添加板块
              </button>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-1)' }}
        >
          {editingGrade ? '保存修改' : '添加成绩'}
        </button>
      </form>
    </Modal>
  );
}
