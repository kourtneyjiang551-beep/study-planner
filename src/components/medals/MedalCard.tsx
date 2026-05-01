'use client';

import type { MedalConditionType, MedalDefinition } from '@/types';

const CONDITION_LABELS: Record<MedalConditionType, string> = {
  study_hours: '累计学习小时',
  sport_hours: '累计运动小时',
  streak_days: '连续打卡天数',
  task_count: '完成任务数',
  first_checkin: '首次打卡',
  custom: '自定义',
};

export { CONDITION_LABELS };

interface MedalCardProps {
  medal: MedalDefinition;
  isUnlocked: boolean;
  unlockDate?: string;
  currentProgress?: number;
  onDelete?: () => void;
}

export default function MedalCard({ medal, isUnlocked, unlockDate, currentProgress, onDelete }: MedalCardProps) {
  return (
    <div
      className="relative rounded-xl p-4 text-center group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: isUnlocked ? `2px solid ${medal.color}` : '2px dashed var(--border)',
        opacity: isUnlocked ? 1 : 0.6,
      }}
    >
      {/* 删除按钮 */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-2 text-xs opacity-0 group-hover:opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-secondary)' }}
        >
          ✕
        </button>
      )}

      <div className="text-3xl mb-2" style={{ filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
        {medal.icon}
      </div>
      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
        {medal.name}
      </p>
      <p className="text-[10px] mb-2" style={{ color: 'var(--text-secondary)' }}>
        {medal.description}
      </p>

      {isUnlocked ? (
        <p className="text-[9px]" style={{ color: medal.color }}>
          ✓ {unlockDate?.slice(0, 10)} 解锁
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {CONDITION_LABELS[medal.condition_type]}: {medal.condition_value}
          </p>
          {currentProgress !== undefined && (
            (() => {
              const pct = Math.min(100, (currentProgress / medal.condition_value) * 100);
              const displayCurrent = medal.condition_type.includes('hours')
                ? currentProgress.toFixed(1)
                : Math.floor(currentProgress);
              return (
                <div>
                  <div className="flex justify-between text-[9px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <span>{displayCurrent}</span>
                    <span>{medal.condition_value}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: medal.color }} />
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
