'use client';

import type { Reward } from '@/types';
import RewardCard from './RewardCard';

interface RewardGridProps {
  rewards: Reward[];
  currentPoints: number;
  onRedeem: (rewardId: string) => void;
  onEdit: (reward: Reward) => void;
  onDelete: (rewardId: string) => void;
}

export default function RewardGrid({ rewards, currentPoints, onRedeem, onEdit, onDelete }: RewardGridProps) {
  if (rewards.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-3xl">🎁</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          还没有奖励，添加孩子喜欢的奖励吧
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {rewards.map(r => (
        <RewardCard
          key={r.id}
          reward={r}
          currentPoints={currentPoints}
          onRedeem={() => onRedeem(r.id)}
          onEdit={() => onEdit(r)}
          onDelete={() => onDelete(r.id)}
        />
      ))}
    </div>
  );
}
