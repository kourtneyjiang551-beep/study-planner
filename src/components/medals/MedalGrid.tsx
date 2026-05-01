'use client';

import type { MedalDefinition, MedalUnlock } from '@/types';
import MedalCard from './MedalCard';

interface MedalGridProps {
  definitions: MedalDefinition[];
  unlocks: MedalUnlock[];
  medalStats: Record<string, number>;
  onDelete?: (medalId: string) => void;
}

export default function MedalGrid({ definitions, unlocks, medalStats, onDelete }: MedalGridProps) {
  const total = definitions.length;

  if (total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-3xl">🏅</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          还没有勋章，点击&ldquo;批量添加&rdquo;从预置列表添加吧
        </p>
      </div>
    );
  }

  const unlockedSet = new Set(unlocks.map(u => u.medal_definition_id));
  const unlockDateMap = new Map(unlocks.map(u => [u.medal_definition_id, u.unlocked_at]));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {definitions.map(d => (
        <MedalCard
          key={d.id}
          medal={d}
          isUnlocked={unlockedSet.has(d.id)}
          unlockDate={unlockDateMap.get(d.id)}
          currentProgress={medalStats[d.condition_type]}
          onDelete={onDelete ? () => onDelete(d.id) : undefined}
        />
      ))}
    </div>
  );
}
