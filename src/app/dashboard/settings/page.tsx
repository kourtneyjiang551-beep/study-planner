'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Pencil, Plus, Lock, Unlock, GripVertical } from 'lucide-react';
import { loadDemoData } from '@/lib/db/seed-demo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/db/database';
import { themes } from '@/lib/themes';
import { themeTerms } from '@/lib/themes/terms';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { usePinGuard } from '@/lib/hooks/usePinGuard';
import { updateChild, deleteChild, createChild, useSubjects, updateSubject, deleteSubject } from '@/lib/db/hooks';
import { seedPresetsForChild, seedSubjectsForChild, seedTemplatesForChild } from '@/lib/db/seed';
import { calculateStreak } from '@/lib/utils/streak';
import ChildFormModal from '@/components/settings/ChildFormModal';
import PinInput from '@/components/ui/PinInput';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { ThemeId } from '@/types';
import bcrypt from 'bcryptjs';

const THEME_IDS: ThemeId[] = ['dojo', 'magic', 'garden', 'ocean'];

/** 校验备份数据结构完整性 */
function validateBackupData(data: Record<string, unknown>): string | null {
  if (!data.version || typeof data.version !== 'number') return '缺少版本号';
  if (!Array.isArray(data.profiles) || data.profiles.length === 0) return '缺少用户信息';
  if (!Array.isArray(data.children) || data.children.length === 0) return '缺少孩子信息';
  for (const child of data.children as Record<string, unknown>[]) {
    if (!child.id || !child.name) return '孩子数据格式错误';
  }
  const arrayFields = ['subjects', 'tasks', 'taskRecords', 'grades', 'medalDefinitions', 'medalUnlocks', 'rewards', 'rewardRedemptions', 'pointsLog'];
  for (const field of arrayFields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) return `${field} 格式错误`;
  }
  return null;
}

export default function SettingsPage() {
  const { themeId, setTheme } = useTheme();
  const { activeChildId, children: allChildren, switchChild } = useActiveChild();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const { hasPin, isVerified: pinContextVerified, markVerified, verifyPin, locked: pinLocked, lockCountdown, pinError } = usePinGuard();

  const profile = useLiveQuery(() => db.profiles.toArray().then(p => p[0]), []);

  // PIN 验证状态直接从 context 派生，无需本地 state + effect
  const pinVerified = profile !== undefined && (!hasPin || pinContextVerified);

  // 科目管理
  const subjects = useSubjects(activeChildId);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectIcon, setEditSubjectIcon] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('');

  // 拖拽排序状态（touch-friendly）
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragY = useRef(0);
  const draggingRef = useRef(false);

  const handleDragStart = (e: React.DragEvent | React.TouchEvent, index: number) => {
    setDragIndex(index);
    if ('touches' in e) {
      draggingRef.current = true;
      dragY.current = e.touches[0].clientY;
    }
  };

  const handleDragOver = (e: React.DragEvent | React.TouchEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
    if ('touches' in e && draggingRef.current) {
      dragY.current = e.touches[0].clientY;
      // 根据 Y 坐标找到最近的列表项
      if (listRef.current) {
        const items = listRef.current.querySelectorAll('[data-drag-index]');
        for (let i = 0; i < items.length; i++) {
          const rect = items[i].getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (dragY.current < midY) {
            setDragOverIndex(i);
            break;
          } else if (i === items.length - 1) {
            setDragOverIndex(i);
          }
        }
      }
    }
  };

  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || !draggingRef.current) {
      setDragIndex(null);
      setDragOverIndex(null);
      draggingRef.current = false;
      return;
    }
    const list = [...(subjects ?? [])];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(dragOverIndex, 0, moved);
    for (let i = 0; i < list.length; i++) {
      await updateSubject(list[i].id, { sort_order: i });
    }
    setDragIndex(null);
    setDragOverIndex(null);
    draggingRef.current = false;
  };

  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const list = [...(subjects ?? [])];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(index, 0, moved);
    for (let i = 0; i < list.length; i++) {
      await updateSubject(list[i].id, { sort_order: i });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleEditSubject = (id: string) => {
    const s = (subjects ?? []).find(sub => sub.id === id);
    if (!s) return;
    setEditingSubjectId(id);
    setEditSubjectName(s.name);
    setEditSubjectIcon(s.icon);
    setEditSubjectColor(s.color);
  };

  const handleSaveSubject = async () => {
    if (!editingSubjectId || !editSubjectName.trim()) return;
    await updateSubject(editingSubjectId, { name: editSubjectName.trim(), icon: editSubjectIcon, color: editSubjectColor });
    setEditingSubjectId(null);
  };

  const handleDeleteSubject = async (id: string) => {
    const okDel = await confirm({ title: '确定删除该科目？关联的任务和成绩将保留但取消科目关联。', danger: true });
    if (okDel) { await deleteSubject(id); toast('科目已删除', 'success'); }
  };

  // Child form modal
  const [childModal, setChildModal] = useState<{ open: boolean; editId?: string }>({ open: false });

  // PIN management
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pendingPin, setPendingPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState(false);

  // 设置页入口 PIN 验证（复用全局 verifyPin）
  const handlePinVerify = async (pin: string) => {
    await verifyPin(pin);
  };

  // 等待 profile 加载
  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  // PIN gate — show this if PIN is set and not verified
  if (hasPin && !pinVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-1)', opacity: 0.15 }}>
          <Lock size={32} style={{ color: 'var(--accent-1)' }} />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>家长验证</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>请输入 4 位 PIN 码进入设置</p>
        </div>
        <PinInput onComplete={handlePinVerify} error={pinError} disabled={pinLocked} />
        {pinLocked && (
          <p className="text-xs" style={{ color: '#EF4444' }}>
            输入错误次数过多，请 {lockCountdown} 秒后重试
          </p>
        )}
      </div>
    );
  }

  // --- Handlers ---

  const handleExport = async () => {
    // 导出时排除 PIN hash，避免泄露或导入时覆盖
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const profiles = (await db.profiles.toArray()).map(({ parent_pin_hash, ...rest }) => rest);
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      profiles,
      children: await db.children.toArray(),
      subjects: await db.subjects.toArray(),
      tasks: await db.tasks.toArray(),
      taskRecords: await db.taskRecords.toArray(),
      grades: await db.grades.toArray(),
      medalDefinitions: await db.medalDefinitions.toArray(),
      medalUnlocks: await db.medalUnlocks.toArray(),
      rewards: await db.rewards.toArray(),
      rewardRedemptions: await db.rewardRedemptions.toArray(),
      pointsLog: await db.pointsLog.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { toast('文件格式错误', 'error'); return; }
    const validationError = validateBackupData(data);
    if (validationError) { toast(`备份文件无效：${validationError}`, 'error'); return; }
    const okImport = await confirm({ title: '导入将覆盖当前所有数据，确定继续吗？', danger: true });
    if (!okImport) return;

    // 保存当前 PIN hash，导入后恢复（避免被外部数据覆盖或丢失）
    const currentPinHash = profile?.parent_pin_hash;

    // 清除导入数据中的 PIN hash（不信任外部 PIN）
    if (data.profiles?.length) {
      data.profiles = data.profiles.map((p: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { parent_pin_hash, ...rest } = p;
        return rest;
      });
    }

    await db.transaction('rw',
      [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
       db.grades, db.medalDefinitions, db.medalUnlocks, db.rewards,
       db.rewardRedemptions, db.pointsLog, db.syncQueue],
      async () => {
        await Promise.all([
          db.profiles.clear(), db.children.clear(), db.subjects.clear(),
          db.tasks.clear(), db.taskRecords.clear(), db.grades.clear(),
          db.medalDefinitions.clear(), db.medalUnlocks.clear(), db.rewards.clear(),
          db.rewardRedemptions.clear(), db.pointsLog.clear(), db.syncQueue.clear(),
        ]);
        if (data.profiles?.length) await db.profiles.bulkAdd(data.profiles);
        if (data.children?.length) await db.children.bulkAdd(data.children);
        if (data.subjects?.length) await db.subjects.bulkAdd(data.subjects);
        if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks);
        if (data.taskRecords?.length) await db.taskRecords.bulkAdd(data.taskRecords);
        if (data.grades?.length) await db.grades.bulkAdd(data.grades);
        if (data.medalDefinitions?.length) await db.medalDefinitions.bulkAdd(data.medalDefinitions);
        if (data.medalUnlocks?.length) await db.medalUnlocks.bulkAdd(data.medalUnlocks);
        if (data.rewards?.length) await db.rewards.bulkAdd(data.rewards);
        if (data.rewardRedemptions?.length) await db.rewardRedemptions.bulkAdd(data.rewardRedemptions);
        if (data.pointsLog?.length) await db.pointsLog.bulkAdd(data.pointsLog);
      }
    );

    // 恢复当前 PIN hash 到导入后的 profile
    if (currentPinHash) {
      const newProfiles = await db.profiles.toArray();
      if (newProfiles.length > 0) {
        await db.profiles.update(newProfiles[0].id, { parent_pin_hash: currentPinHash });
      }
    }

    // 导入后重新计算积分余额和连续打卡天数
    for (const child of data.children ?? []) {
      // 从 points_log 重算积分
      const logs = (data.pointsLog ?? []).filter((l: { child_id: string }) => l.child_id === child.id);
      const pointsSum = logs.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);
      await db.children.update(child.id, { current_points: pointsSum, updated_at: new Date().toISOString() });
      // 重算连续打卡
      await calculateStreak(child.id);
    }

    toast('导入成功！' + (currentPinHash ? '（PIN 保护已保留）' : ''), 'success');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleLoadDemo = async () => {
    const okDemo = await confirm({ title: '加载演示数据将覆盖当前所有数据，确定继续？', danger: true });
    if (!okDemo) return;
    await loadDemoData(activeChildId);
    toast('演示数据加载成功！', 'success');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleClear = async () => {
    const okClear = await confirm({ title: '确定要清空所有数据？', description: '所有学习计划和打卡记录将被永久删除，此操作不可撤销。', confirmText: '清空', danger: true });
    if (!okClear) return;
    await db.transaction('rw',
      [db.children, db.subjects, db.tasks, db.taskRecords, db.grades,
       db.medalDefinitions, db.medalUnlocks, db.rewards, db.rewardRedemptions, db.pointsLog, db.syncQueue],
      async () => {
        await Promise.all([
          db.subjects.clear(), db.tasks.clear(), db.taskRecords.clear(),
          db.grades.clear(), db.medalDefinitions.clear(), db.medalUnlocks.clear(),
          db.rewards.clear(), db.rewardRedemptions.clear(), db.pointsLog.clear(),
          db.syncQueue.clear(),
        ]);
        await db.children.update(activeChildId, {
          current_points: 0, streak_days: 0, updated_at: new Date().toISOString(),
        });
      }
    );
    toast('数据已清空', 'success');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleDeleteChild = async (childId: string) => {
    if (allChildren.length <= 1) { toast('至少需要保留一个孩子', 'error'); return; }
    const okDel = await confirm({ title: '确定要删除该孩子及其所有数据吗？', danger: true });
    if (!okDel) return;
    await deleteChild(childId);
    if (childId === activeChildId) {
      const remaining = allChildren.find(c => c.id !== childId);
      if (remaining) await switchChild(remaining.id);
    }
  };

  const handleAddChild = async (data: { name: string; grade: string; avatar: string }) => {
    const profileId = profile?.id;
    if (!profileId) return;
    const childId = await createChild(profileId, { name: data.name, grade: data.grade });
    await db.children.update(childId, { avatar: data.avatar });
    await seedPresetsForChild(childId);
    await seedSubjectsForChild(childId);
    await seedTemplatesForChild(childId);
  };

  const handleEditChild = async (data: { name: string; grade: string; avatar: string }) => {
    if (!childModal.editId) return;
    await updateChild(childModal.editId, { name: data.name, grade: data.grade, avatar: data.avatar });
  };

  // PIN management
  const handleSetPin = async (pin: string) => {
    if (pinStep === 'enter') {
      setPendingPin(pin);
      setPinStep('confirm');
      return;
    }
    if (pin !== pendingPin) {
      setPinSetupError(true);
      setTimeout(() => setPinSetupError(false), 600);
      setPinStep('enter');
      setPendingPin('');
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    if (profile) {
      await db.profiles.update(profile.id, { parent_pin_hash: hash, updated_at: new Date().toISOString() });
    }
    markVerified(); // 写入时间戳并同步到全局 PinGuard
    setShowPinSetup(false);
    setPinStep('enter');
    setPendingPin('');
  };

  const handleRemovePin = async () => {
    const okPin = await confirm({ title: '确定关闭 PIN 保护？', danger: false });
    if (!okPin) return;
    if (profile) {
      // 使用 modify + delete 确保彻底移除字段（update 传 undefined 可能不生效）
      await db.profiles.where('id').equals(profile.id).modify(p => {
        delete p.parent_pin_hash;
        p.updated_at = new Date().toISOString();
      });
    }
    // PIN 移除后无需清理 sessionStorage — PinGuardProvider 会检测 hasPin=false 自动放行
  };

  const editingChild = childModal.editId ? allChildren.find(c => c.id === childModal.editId) : undefined;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
        </a>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>⚙️ 设置</h1>
      </div>

      {/* 孩子管理 */}
      <Section title="👤 孩子管理">
        <div className="space-y-2">
          {allChildren.map(child => (
            <div key={child.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: child.id === activeChildId ? 'var(--accent-1)10' : 'transparent' }}>
              <span className="text-xl">{child.avatar || '👦'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{child.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{child.grade}</p>
              </div>
              <button onClick={() => setChildModal({ open: true, editId: child.id })} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" style={{ color: 'var(--text-secondary)' }} aria-label={`编辑${child.name}`}>
                <Pencil size={14} />
              </button>
              {allChildren.length > 1 && (
                <button onClick={() => handleDeleteChild(child.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" style={{ color: '#EF4444' }} aria-label={`删除${child.name}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setChildModal({ open: true })} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--accent-1)' }}>
            <Plus size={14} />
            <span>添加孩子</span>
          </button>
        </div>
      </Section>

      {/* PIN 保护 */}
      <Section title="🔒 PIN 保护">
        {showPinSetup ? (
          <div className="space-y-3 text-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {pinStep === 'enter' ? '请输入 4 位 PIN 码' : '请再次输入确认'}
            </p>
            <PinInput key={pinStep} onComplete={handleSetPin} error={pinSetupError} />
            <button onClick={() => { setShowPinSetup(false); setPinStep('enter'); setPendingPin(''); }} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              取消
            </button>
          </div>
        ) : hasPin ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={14} style={{ color: 'var(--accent-1)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>PIN 保护已开启</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPinSetup(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  修改
                </button>
                <button onClick={handleRemovePin} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#EF4444' }}>
                  关闭
                </button>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>以下操作需要 PIN 验证：</p>
              <div className="flex flex-wrap gap-1.5">
                {['进入设置页', '添加/删除奖励', '添加/删除勋章', '导出/导入数据', '清空数据'].map(item => (
                  <span key={item} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    🔒 {item}
                  </span>
                ))}
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                验证后 30 分钟内无需重复输入，超时或关闭浏览器后需重新验证
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setShowPinSetup(true)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-primary)' }}>
              <Unlock size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>设置 PIN 保护</span>
            </button>
            <p className="text-[10px] px-3" style={{ color: 'var(--text-secondary)' }}>
              开启后，设置页、奖励管理、勋章管理等敏感操作需要输入 PIN 码才能执行，防止孩子误操作
            </p>
          </div>
        )}
      </Section>

      {/* 科目管理 */}
      <Section title="📚 科目管理">
        {editingSubjectId ? (
          <div className="flex items-center gap-2">
            <input
              value={editSubjectIcon}
              onChange={e => setEditSubjectIcon(e.target.value)}
              className="w-10 text-center rounded-lg px-1 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              maxLength={2}
            />
            <input
              value={editSubjectName}
              onChange={e => setEditSubjectName(e.target.value)}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              autoFocus
            />
            <input
              type="color"
              value={editSubjectColor}
              onChange={e => setEditSubjectColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
              style={{ border: 'none', padding: 0 }}
            />
            <button onClick={handleSaveSubject} className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ backgroundColor: 'var(--accent-1)' }}>保存</button>
            <button onClick={() => setEditingSubjectId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>取消</button>
          </div>
        ) : (
          <div className="space-y-1" ref={listRef}>
            {(subjects ?? []).map((s, i) => (
              <div
                key={s.id}
                data-drag-index={i}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleDragStart(e, i)}
                onTouchMove={(e) => handleDragOver(e, i)}
                onTouchEnd={handleDragEnd}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: dragOverIndex === i ? 'var(--accent-1)10' : 'transparent',
                  opacity: dragIndex === i ? 0.4 : 1,
                  borderTop: dragOverIndex === i && dragIndex !== null && dragIndex > i ? '2px solid var(--accent-1)' : '2px solid transparent',
                  borderBottom: dragOverIndex === i && dragIndex !== null && dragIndex < i ? '2px solid var(--accent-1)' : '2px solid transparent',
                  cursor: 'grab',
                }}
              >
                <GripVertical size={14} className="shrink-0 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm">{s.icon}</span>
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                <button onClick={() => handleEditSubject(s.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-secondary)' }} aria-label={`编辑${s.name}`}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteSubject(s.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: '#EF4444' }} aria-label={`删除${s.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(!subjects || subjects.length === 0) && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>暂无科目，在添加任务时创建</p>
            )}
          </div>
        )}
      </Section>

      {/* 主题切换 */}
      <Section title="🎨 主题切换">
        <div className="grid grid-cols-2 gap-3">
          {THEME_IDS.map(id => {
            const t = themes[id];
            const active = id === themeId;
            return (
              <button key={id} onClick={() => setTheme(id)} className="rounded-xl p-3 text-center transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: t.colors.bgPrimary, border: active ? `2px solid ${t.colors.accent1}` : '2px solid transparent', boxShadow: active ? `0 0 12px ${t.colors.accent1}40` : 'none' }}>
                <div className="flex gap-1 justify-center mb-2">
                  {[t.colors.accent1, t.colors.accent2, t.colors.accent3, t.colors.accent4, t.colors.accent5].map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs font-semibold" style={{ color: t.colors.textPrimary }}>{t.name}</p>
                {active && <p className="text-[10px] mt-0.5" style={{ color: t.colors.accent1 }}>当前使用</p>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 数据管理 */}
      <Section title="💾 数据管理">
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <Download size={16} style={{ color: 'var(--text-secondary)' }} /> 导出备份 (JSON)
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <Upload size={16} style={{ color: 'var(--text-secondary)' }} /> 导入备份
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={handleClear} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: '#FF6B6B15', color: '#FF6B6B' }}>
            <Trash2 size={16} /> 清空所有数据
          </button>
        </div>
      </Section>

      {/* 开发工具 */}
      <Section title="🧪 开发工具">
        <button onClick={handleLoadDemo} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          🎭 加载演示数据（30 天完整数据）
        </button>
      </Section>

      {/* 关于 */}
      <Section title="ℹ️ 关于">
        <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <p>好学伴 Study Planner v1.0</p>
          <p>数据存储于本地浏览器 (IndexedDB)，不会上传到服务器</p>
        </div>
      </Section>

      {/* 游戏机制说明 */}
      <Section title="🎮 玩法机制说明">
        <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <HelpItem
            icon="🏆"
            title="等级/段位"
            description={`根据积累的${themeTerms[themeId].points}自动升级。当前等级和进度显示在顶部面板。不同主题有独立的等级体系（段位/魔法等级/园丁等级/潜水等级）。`}
            color="var(--accent-1)"
          />
          <HelpItem
            icon="✨"
            title={`${themeTerms[themeId].medal}解锁条件`}
            description={`包含累计学习时长、运动时长、连续打卡天数、任务完成数、首次打卡等。完成${themeTerms[themeId].task}时自动检测并通知。`}
            color="var(--accent-2)"
          />
          <HelpItem
            icon="💎"
            title={`${themeTerms[themeId].points}获取方式`}
            description={`完成${themeTerms[themeId].task}: 根据时长自动计算（约每3分钟1点）。也可手动调整${themeTerms[themeId].points_reward}。${themeTerms[themeId].points}用于${themeTerms[themeId].reward}兑换。`}
            color="var(--accent-3)"
          />
          <HelpItem
            icon="🔥"
            title="连续打卡"
            description={`每天完成至少1个${themeTerms[themeId].task}即算1天。连续天数越多，解锁高级${themeTerms[themeId].medal}的门槛。中断后从零重新计算。`}
            color="var(--accent-4)"
          />
          <HelpItem
            icon="📋"
            title={`${themeTerms[themeId].task}模板`}
            description={`添加${themeTerms[themeId].task}时勾选"保存为模板"，后续可在首页快速复用相同${themeTerms[themeId].plan}配置。`}
            color="var(--accent-5)"
          />
        </div>
      </Section>

      {/* Child form modal */}
      <ChildFormModal
        key={childModal.editId ?? 'new'}
        open={childModal.open}
        onClose={() => setChildModal({ open: false })}
        onSubmit={childModal.editId ? handleEditChild : handleAddChild}
        initialData={editingChild ? { name: editingChild.name, grade: editingChild.grade, avatar: editingChild.avatar } : undefined}
        title={childModal.editId ? '编辑孩子' : '添加孩子'}
      />
      {ConfirmDialogEl}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  );
}

function HelpItem({ icon, title, description, color }: { icon: string; title: string; description: string; color: string }) {
  return (
    <div className="flex gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <span className="text-lg shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold mb-0.5" style={{ color: color }}>{title}</p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
    </div>
  );
}
