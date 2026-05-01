'use client';

import { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import type { Subject, SubjectCategory } from '@/types';

// 预设颜色
const PRESET_COLORS = [
  '#FF6B6B', '#FF8C42', '#FFD93D', '#6BCB77',
  '#4D96FF', '#9B59B6', '#E84393', '#00CEC9',
  '#636E72', '#2D3436', '#A29BFE', '#FD79A8',
];

// 常用 emoji 网格
const PRESET_EMOJIS = [
  '📖', '📐', '🔬', '🌍', '🎨', '🎵',
  '⚽', '🏀', '🏃', '💻', '📝', '🧮',
  '🇬🇧', '📚', '🎯', '🧪', '🎹', '🏊',
];

const CATEGORY_OPTIONS: { value: SubjectCategory; label: string }[] = [
  { value: 'academic', label: '学习' },
  { value: 'sport', label: '运动' },
  { value: 'entertainment', label: '娱乐' },
];

interface SubjectSelectProps {
  subjects: Subject[];
  value?: string;
  onChange: (subjectId: string) => void;
  onCreateSubject: (data: { name: string; color: string; icon: string; category: SubjectCategory }) => Promise<string>;
}

export default function SubjectSelect({ subjects, value, onChange, onCreateSubject }: SubjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 新建科目表单状态
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon] = useState(PRESET_EMOJIS[0]);
  const [newCategory, setNewCategory] = useState<SubjectCategory>('academic');

  const selectedSubject = subjects.find(s => s.id === value);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await onCreateSubject({
      name: newName.trim(),
      color: newColor,
      icon: newIcon,
      category: newCategory,
    });
    onChange(id);
    setIsCreating(false);
    setIsOpen(false);
    setNewName('');
  };

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
      >
        <span className="flex items-center gap-2">
          {selectedSubject ? (
            <>
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: selectedSubject.color }}
              />
              {selectedSubject.icon} {selectedSubject.name}
            </>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>选择科目</span>
          )}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl p-2 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* 已有科目列表 */}
          {subjects.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span>{s.icon}</span>
              <span>{s.name}</span>
              {s.id === value && <span className="ml-auto text-xs" style={{ color: 'var(--accent-1)' }}>✓</span>}
            </button>
          ))}

          {/* 分隔线 */}
          {subjects.length > 0 && (
            <div className="my-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          )}

          {/* 新建科目 */}
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5"
              style={{ color: 'var(--accent-1)' }}
            >
              <Plus size={14} />
              新建科目
            </button>
          ) : (
            <div className="space-y-3 p-2">
              {/* 科目名 */}
              <input
                type="text"
                placeholder="科目名称"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                autoFocus
              />

              {/* 分类 */}
              <div className="flex gap-1">
                {CATEGORY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewCategory(opt.value)}
                    className="rounded-lg px-3 py-1 text-xs transition-colors"
                    style={{
                      backgroundColor: newCategory === opt.value ? 'var(--accent-1)' : 'var(--bg-secondary)',
                      color: newCategory === opt.value ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 颜色选择 */}
              <div>
                <span className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>颜色</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className="h-6 w-6 rounded-full transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: newColor === color ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: newColor === color ? `0 0 0 2px var(--bg-card), 0 0 0 3px ${color}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Emoji 选择 */}
              <div>
                <span className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>图标</span>
                <div className="grid grid-cols-6 gap-1">
                  {PRESET_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors"
                      style={{
                        backgroundColor: newIcon === emoji ? 'var(--accent-1)' : 'transparent',
                        opacity: newIcon === emoji ? 1 : 0.7,
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--accent-1)' }}
                >
                  创建
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
