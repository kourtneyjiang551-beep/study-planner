'use client';

import { useState } from 'react';
import { ArrowLeft, Plus, Gift, History } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useTheme } from '@/components/ThemeProvider';
import {
  useRewards,
  usePointsLog,
  createReward,
  deleteReward,
  updateReward,
  redeemReward,
} from '@/lib/db/hooks';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { usePinGuard } from '@/lib/hooks/usePinGuard';
import Modal from '@/components/ui/Modal';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import RewardGrid from '@/components/rewards/RewardGrid';
import PointsLogList from '@/components/rewards/PointsLog';
import type { Reward } from '@/types';

type Tab = 'pool' | 'log';

export default function RewardsPage() {
  const { t } = useTheme();
  const { activeChildId } = useActiveChild();
  const { confirm, ConfirmDialogEl } = useConfirmDialog();
  const { requirePin } = usePinGuard();
  const [tab, setTab] = useState<Tab>('pool');
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  const child = useLiveQuery(() => db.children.get(activeChildId), []);
  const rewards = useRewards(activeChildId);
  const pointsLog = usePointsLog(activeChildId);

  const handleRedeem = async (rewardId: string) => {
    const ok = await redeemReward(activeChildId, rewardId);
    if (!ok) toast('积分不足或已兑完', 'error');
    else toast('兑换成功！', 'success');
  };

  const handleShowAddForm = async () => {
    const ok = await requirePin();
    if (ok) setShowForm(true);
  };

  const handleAddReward = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qtyStr = fd.get('quantity') as string;
    const data = {
      name: fd.get('name') as string,
      description: fd.get('description') as string || '',
      icon: fd.get('icon') as string || '🎁',
      points_cost: Number(fd.get('points_cost')),
      quantity: qtyStr ? Number(qtyStr) : null,
    };
    if (editingReward) {
      await updateReward(editingReward.id, data);
      setEditingReward(null);
      toast('奖励已更新', 'success');
    } else {
      await createReward(activeChildId, data);
      toast('奖励已添加', 'success');
    }
    setShowForm(false);
  };

  const handleDeleteReward = async (rewardId: string) => {
    const pinOk = await requirePin();
    if (!pinOk) return;
    const ok = await confirm({ title: '确定删除这个奖励？', danger: true });
    if (ok) { await deleteReward(rewardId); toast('奖励已删除', 'success'); }
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  const tabStyle = (active: boolean) => ({
    backgroundColor: active ? 'var(--accent-1)' : 'var(--bg-secondary)',
    color: active ? 'white' : 'var(--text-secondary)',
  });

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </a>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            💎 {t('points')}{t('reward')}
          </h1>
        </div>
        {tab === 'pool' && (
          <button
            onClick={handleShowAddForm}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-1)' }}
          >
            <Plus size={16} />
            添加奖励
          </button>
        )}
      </div>

      {/* 积分余额 */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>当前{t('points')}</p>
        <p className="text-4xl font-bold" style={{ color: 'var(--accent-1)' }}>
          💎 {child?.current_points ?? 0}
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('pool')}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          style={tabStyle(tab === 'pool')}
        >
          <Gift size={14} />
          奖励池
        </button>
        <button
          onClick={() => setTab('log')}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          style={tabStyle(tab === 'log')}
        >
          <History size={14} />
          积分记录
        </button>
      </div>

      {/* 奖励池 Tab */}
      {tab === 'pool' && (
        <RewardGrid
          rewards={rewards ?? []}
          currentPoints={child?.current_points ?? 0}
          onRedeem={handleRedeem}
          onEdit={(r) => { setEditingReward(r); setShowForm(true); }}
          onDelete={handleDeleteReward}
        />
      )}

      {/* 积分记录 Tab */}
      {tab === 'log' && <PointsLogList logs={pointsLog ?? []} />}

      {/* 添加奖励表单 */}
      <Modal open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingReward(null); } }} title={editingReward ? '编辑奖励' : '添加奖励'}>
        <form key={editingReward?.id ?? 'new'} onSubmit={handleAddReward} className="space-y-3">
          <input name="name" required placeholder="奖励名称" defaultValue={editingReward?.name} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input name="description" placeholder="描述（选填）" defaultValue={editingReward?.description} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input name="icon" placeholder="图标 emoji" defaultValue={editingReward?.icon ?? '🎁'} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            <input name="points_cost" type="number" required placeholder="所需积分" defaultValue={editingReward?.points_cost} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <input name="quantity" type="number" placeholder="数量限制（留空=无限）" defaultValue={editingReward?.quantity ?? ''} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: 'var(--accent-1)' }}>
            {editingReward ? '保存修改' : '添加奖励'}
          </button>
        </form>
      </Modal>
      {ConfirmDialogEl}
    </div>
  );
}
