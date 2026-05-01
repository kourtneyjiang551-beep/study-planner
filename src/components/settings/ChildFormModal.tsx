'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

const AVATAR_OPTIONS = ['👦', '👧', '🧒', '👶', '🦁', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄'];
const GRADE_OPTIONS = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三', '高一', '高二', '高三', '其他',
];

interface ChildFormData {
  name: string;
  grade: string;
  avatar: string;
}

interface ChildFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChildFormData) => Promise<void>;
  initialData?: ChildFormData;
  title?: string;
}

export default function ChildFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title = '添加孩子',
}: ChildFormModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [grade, setGrade] = useState(initialData?.grade ?? '三年级');
  const [avatar, setAvatar] = useState(initialData?.avatar ?? '👦');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({ name: name.trim(), grade, avatar });
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={title}>
      <div className="space-y-4">
        {/* 头像选择 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>头像</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_OPTIONS.map(a => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className="w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  backgroundColor: a === avatar ? 'var(--accent-1)' : 'var(--bg-secondary)',
                  opacity: a === avatar ? 1 : 0.6,
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* 姓名 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>姓名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="请输入孩子姓名"
            className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            autoFocus
          />
        </div>

        {/* 年级 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>年级</label>
          <Select
            value={grade}
            onValueChange={setGrade}
            options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
          />
        </div>

        {/* 提交 */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-1)' }}
        >
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </Modal>
  );
}
