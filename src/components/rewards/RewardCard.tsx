'use client';

import { Pencil } from 'lucide-react';
import type { Reward } from '@/types';

interface RewardCardProps {
  reward: Reward;
  currentPoints: number;
  onRedeem: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RewardCard({ reward, currentPoints, onRedeem, onEdit, onDelete }: RewardCardProps) {
  const soldOut = reward.quantity !== null && reward.quantity <= 0;
  const canAfford = currentPoints >= reward.points_cost;

  return (
    <div
      className="relative rounded-xl p-4 text-center group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        opacity: soldOut ? 0.5 : 1,
      }}
    >
      {/* 编辑/删除 */}
      <div className="absolute top-1 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="text-xs hover:opacity-100 opacity-60"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={`编辑${reward.name}`}
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="text-xs hover:opacity-100 opacity-60"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={`删除${reward.name}`}
        >
          ✕
        </button>
      </div>

      <div className="text-3xl mb-2">{reward.icon}</div>
      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{reward.name}</p>
      {reward.description && (
        <p className="text-[10px] mb-2" style={{ color: 'var(--text-secondary)' }}>{reward.description}</p>
      )}
      <p className="text-xs font-bold mb-2" style={{ color: 'var(--accent-1)' }}>
        💎 {reward.points_cost}
        {reward.quantity !== null && (
          <span className="font-normal" style={{ color: 'var(--text-secondary)' }}> · 剩{reward.quantity}个</span>
        )}
      </p>
      <button
        onClick={onRedeem}
        disabled={soldOut || !canAfford}
        className="w-full rounded-lg py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: 'var(--accent-1)' }}
      >
        {soldOut ? '已兑完' : canAfford ? '兑换' : '积分不足'}
      </button>
    </div>
  );
}
