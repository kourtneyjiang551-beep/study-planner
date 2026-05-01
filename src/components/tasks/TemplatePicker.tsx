'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from '@/components/ui/Toast';
import { deleteTemplate } from '@/lib/db/hooks';
import Modal from '@/components/ui/Modal';
import type { Task } from '@/types';

const REPEAT_LABELS: Record<string, string> = {
  daily: '每天', weekdays: '周一至周五', once: '仅一次', custom: '自定义',
};

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onApply: (template: Task) => void;
}

export default function TemplatePicker({ open, onClose, onApply }: TemplatePickerProps) {
  const { activeChildId } = useActiveChild();
  const { t } = useTheme();

  const templates = useLiveQuery(
    () => db.tasks.where({ child_id: activeChildId }).filter(t => t.is_template && t.is_active).sortBy('sort_order'),
    [activeChildId],
  );

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    toast('模板已删除', 'success');
  };

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={`从模板创建${t('task')}`}>
      {!templates || templates.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有模板，在添加{t('task')}时勾选&ldquo;保存为模板&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-black/5 group"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
              onClick={() => { onApply(tpl); onClose(); }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tpl.name}</p>
                {tpl.content && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{tpl.content}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-1)', color: '#fff', opacity: 0.8 }}>
                    {REPEAT_LABELS[tpl.repeat_type] ?? tpl.repeat_type}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {tpl.planned_duration_minutes}分钟
                  </span>
                  {tpl.points_reward > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--accent-1)' }}>+{tpl.points_reward}分</span>
                  )}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(tpl.id); }}
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1"
                style={{ color: '#EF4444' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
