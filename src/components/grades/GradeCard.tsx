import { Pencil, Trash2 } from 'lucide-react';
import type { Grade } from '@/types';

function getRating(score: number, total: number) {
  const pct = (score / total) * 100;
  if (pct >= 100) return { label: '学神', color: '#22c55e' };
  if (pct >= 95) return { label: '完美', color: '#3b82f6' };
  if (pct >= 85) return { label: '优秀', color: '#a855f7' };
  if (pct >= 70) return { label: '良好', color: '#f97316' };
  return null;
}

export default function GradeCard({
  grade,
  subjectName,
  subjectColor,
  onEdit,
  onDelete,
}: {
  grade: Grade;
  subjectName: string;
  subjectColor: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rating = getRating(grade.score, grade.total_score);

  return (
    <div
      className="rounded-xl p-4 relative group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* 操作按钮 */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
          aria-label="编辑成绩"
        >
          <Pencil size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
          aria-label="删除成绩"
        >
          <Trash2 size={13} style={{ color: 'var(--accent-4, #FF6B6B)' }} />
        </button>
      </div>

      <div className="flex items-start gap-4">
        {/* 左侧信息 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
            <span className="text-xs font-medium" style={{ color: subjectColor }}>{subjectName}</span>
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {grade.exam_name}
          </p>
          <div className="flex items-center gap-2 flex-wrap text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            <span>📅 {grade.exam_date}</span>
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {grade.exam_type}
            </span>
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {grade.grade_level} {grade.semester}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {grade.target_score != null && <span>🎯 目标: {grade.target_score}</span>}
            {grade.class_avg != null && <span>📊 平均: {grade.class_avg}</span>}
            {grade.class_max != null && <span>🏆 最高: {grade.class_max}</span>}
            {grade.class_rank != null && <span>🏅 班级第{grade.class_rank}名</span>}
          </div>
        </div>

        {/* 右侧分数 */}
        <div
          className="flex flex-col items-center justify-center w-16 h-16 rounded-xl shrink-0"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{grade.score}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>/{grade.total_score}</span>
          {rating && (
            <span className="text-[9px] font-medium" style={{ color: rating.color }}>
              {rating.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
