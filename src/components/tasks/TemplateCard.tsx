'use client';

import { Clock, Star, Plus, Play, Pencil, Trash2 } from 'lucide-react';
import type { RepeatType } from '@/types';

const repeatLabel: Record<RepeatType, string> = {
  daily: '每天',
  weekdays: '周一至周五',
  once: '仅一次',
  custom: '自定义',
};

interface TemplateCardProps {
  name: string;
  content: string;
  repeatType: RepeatType;
  duration: number;
  points: number;
  onAdd?: () => void;
  /** 编辑模板 */
  onEdit?: () => void;
  /** 已有模板的"创建任务"按钮 */
  onCreateTask?: () => void;
  /** 已有模板的"删除"按钮 */
  onDelete?: () => void;
}

export default function TemplateCard({
  name, content, repeatType, duration, points,
  onAdd, onEdit, onCreateTask, onDelete,
}: TemplateCardProps) {
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {name}
          </h3>
          {content && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              {content}
            </p>
          )}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="ml-2 flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80"
            style={{ backgroundColor: 'var(--accent-1)', color: 'white' }}
            title="添加到我的模板"
          >
            <Plus size={14} />
          </button>
        )}
        {onCreateTask && (
          <button
            onClick={onCreateTask}
            className="ml-2 flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80"
            style={{ backgroundColor: 'var(--accent-1)', color: 'white' }}
            title="创建任务"
          >
            <Play size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {repeatLabel[repeatType]} · {duration}分钟
        </span>
        <span className="flex items-center gap-1">
          <Star size={12} />
          {points}积分
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="ml-auto flex items-center gap-1 hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            title="编辑模板"
          >
            <Pencil size={12} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            title="删除模板"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
