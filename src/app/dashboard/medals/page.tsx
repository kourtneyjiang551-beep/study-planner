'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from '@/components/ui/Toast';
import {
  useMedalDefinitions,
  useMedalUnlocks,
  createMedalDefinition,
  deleteMedalDefinition,
} from '@/lib/db/hooks';
import { useMedalChecker, useMedalStats } from '@/lib/hooks/useMedalChecker';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { usePinGuard } from '@/lib/hooks/usePinGuard';
import MedalGrid from '@/components/medals/MedalGrid';
import { CONDITION_LABELS } from '@/components/medals/MedalCard';
import type { MedalConditionType } from '@/types';

const PRESET_MEDALS = [
  { name: '初次启航', description: '完成第一次打卡', icon: '🚀', color: '#FFD93D', condition_type: 'first_checkin' as MedalConditionType, condition_value: 1 },
  { name: '学习新星', description: '累计学习 10 小时', icon: '⭐', color: '#5B8DEF', condition_type: 'study_hours' as MedalConditionType, condition_value: 10 },
  { name: '知识达人', description: '累计学习 50 小时', icon: '🧠', color: '#A78BFA', condition_type: 'study_hours' as MedalConditionType, condition_value: 50 },
  { name: '学霸之路', description: '累计学习 100 小时', icon: '🎓', color: '#22c55e', condition_type: 'study_hours' as MedalConditionType, condition_value: 100 },
  { name: '运动健将', description: '累计运动 20 小时', icon: '💪', color: '#4ECDC4', condition_type: 'sport_hours' as MedalConditionType, condition_value: 20 },
  { name: '三天打鱼', description: '连续打卡 3 天', icon: '🔥', color: '#FF6B6B', condition_type: 'streak_days' as MedalConditionType, condition_value: 3 },
  { name: '七日坚持', description: '连续打卡 7 天', icon: '🌟', color: '#FFD93D', condition_type: 'streak_days' as MedalConditionType, condition_value: 7 },
  { name: '习惯养成', description: '连续打卡 21 天', icon: '🏆', color: '#f97316', condition_type: 'streak_days' as MedalConditionType, condition_value: 21 },
  { name: '任务收割机', description: '完成 50 个任务', icon: '🎯', color: '#3b82f6', condition_type: 'task_count' as MedalConditionType, condition_value: 50 },
  { name: '百战百胜', description: '完成 100 个任务', icon: '👑', color: '#a855f7', condition_type: 'task_count' as MedalConditionType, condition_value: 100 },
];

export default function MedalsPage() {
  const { t } = useTheme();
  const { activeChildId } = useActiveChild();
  const definitions = useMedalDefinitions(activeChildId);
  const unlocks = useMedalUnlocks(activeChildId);
  const { checkMedals } = useMedalChecker(activeChildId);
  const medalStats = useMedalStats(activeChildId);
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const { requirePin } = usePinGuard();
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    checkMedals().then(names => names.forEach(n => toast(`恭喜解锁勋章：${n}`, 'success')));
  }, [checkMedals]);

  const existingNames = new Set((definitions ?? []).map(d => d.name));

  const handleShowPresets = async () => {
    const ok = await requirePin();
    if (ok) setShowPresets(true);
  };

  const handleShowCustomForm = async () => {
    const ok = await requirePin();
    if (ok) setShowForm(true);
  };

  const handleAddPresets = async (selected: typeof PRESET_MEDALS) => {
    for (const p of selected) {
      if (existingNames.has(p.name)) continue;
      await createMedalDefinition(activeChildId, { ...p, is_preset: true });
    }
    setShowPresets(false);
    const names = await checkMedals();
    names.forEach(n => toast(`恭喜解锁勋章：${n}`, 'success'));
  };

  const handleCustomSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createMedalDefinition(activeChildId, {
      name: fd.get('name') as string,
      description: fd.get('description') as string,
      icon: fd.get('icon') as string || '🏅',
      color: fd.get('color') as string || '#FFD93D',
      condition_type: fd.get('condition_type') as MedalConditionType,
      condition_value: Number(fd.get('condition_value')),
      is_preset: false,
    });
    setShowForm(false);
    const names = await checkMedals();
    names.forEach(n => toast(`恭喜解锁勋章：${n}`, 'success'));
  };

  const handleDeleteMedal = async (medalId: string) => {
    const pinOk = await requirePin();
    if (!pinOk) return;
    const ok = await confirm({ title: '确定删除这个勋章？', danger: true });
    if (ok) deleteMedalDefinition(medalId);
  };

  const total = (definitions ?? []).length;
  const unlocked = (unlocks ?? []).length;

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </a>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            🏅 {t('medal')}墙 ({unlocked}/{total})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShowPresets}
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            批量添加
          </button>
          <button
            onClick={handleShowCustomForm}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-1)' }}
          >
            <Plus size={16} />
            自定义
          </button>
        </div>
      </div>

      {/* 勋章网格 */}
      <MedalGrid
        definitions={definitions ?? []}
        unlocks={unlocks ?? []}
        medalStats={medalStats}
        onDelete={handleDeleteMedal}
      />

      {/* 自定义勋章表单 */}
      <Modal open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }} title="自定义勋章">
        <form onSubmit={handleCustomSubmit} className="space-y-3">
          <input name="name" required placeholder="勋章名称" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="description" placeholder="描述" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input name="icon" placeholder="图标 emoji" defaultValue="🏅" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            <input name="color" type="color" defaultValue="#FFD93D" className="rounded-lg px-1 py-1 h-10" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              name="condition_type"
              required
              defaultValue="study_hours"
              options={Object.entries(CONDITION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
            <input name="condition_value" type="number" required placeholder="目标值" defaultValue={1} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: 'var(--accent-1)' }}>
            添加勋章
          </button>
        </form>
      </Modal>

      {/* 预置勋章选择 */}
      <PresetSelector
        open={showPresets}
        onClose={() => setShowPresets(false)}
        existingNames={existingNames}
        onAdd={handleAddPresets}
      />
      {ConfirmDialogEl}
    </div>
  );
}

function PresetSelector({
  open,
  onClose,
  existingNames,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  existingNames: Set<string>;
  onAdd: (selected: typeof PRESET_MEDALS) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const available = PRESET_MEDALS.filter(p => !existingNames.has(p.name));

  return (
    <Modal open={open} onOpenChange={v => { if (!v) onClose(); }} title="批量添加预置勋章">
      {available.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>所有预置勋章已添加</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {available.map((p, i) => (
              <label
                key={p.name}
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
                style={{ backgroundColor: selected.has(i) ? 'var(--bg-secondary)' : 'transparent' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="accent-[var(--accent-1)]"
                />
                <span className="text-xl">{p.icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{p.description}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={() => onAdd(available.filter((_, i) => selected.has(i)))}
            disabled={selected.size === 0}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent-1)' }}
          >
            添加 {selected.size} 个勋章
          </button>
        </div>
      )}
    </Modal>
  );
}
