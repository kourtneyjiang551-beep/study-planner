'use client';

import { useMemo, useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { useKPI } from '@/lib/hooks/useKPI';
import { getLevel, getNextLevel, getLevelProgress, LEVELS, type Level } from '@/lib/utils/levels';
import type { ThemeId } from '@/types';

/** 独立的等级/段位可视化面板，点击 KPI 等级卡片展开 */
export default function LevelPanel() {
  const [open, setOpen] = useState(false);
  const { themeId, theme, t } = useTheme();
  const { activeChildId } = useActiveChild();
  const kpi = useKPI(activeChildId);

  const currentLevel = useMemo(
    () => getLevel(themeId as ThemeId, kpi.currentPoints),
    [themeId, kpi.currentPoints],
  );
  const nextLevel = useMemo(
    () => getNextLevel(themeId as ThemeId, kpi.currentPoints),
    [themeId, kpi.currentPoints],
  );
  const progress = useMemo(
    () => getLevelProgress(themeId as ThemeId, kpi.currentPoints),
    [themeId, kpi.currentPoints],
  );
  const allLevels = useMemo(() => LEVELS[themeId as ThemeId], [themeId]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-xl px-4 py-3 min-w-[160px] w-[160px] flex-shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
        aria-label={`${t('level')}详情`}
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{ backgroundColor: `${theme.colors.accent4}20`, color: theme.colors.accent4 }}
        >
          <span className="text-lg">{currentLevel.icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t('level')}</p>
          <p className="text-lg font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {currentLevel.name}
          </p>
          {nextLevel && (
            <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
              下一级: {nextLevel.name}
            </p>
          )}
        </div>
      </button>
    );
  }

  // 已达到的等级数
  const currentIndex = allLevels.indexOf(currentLevel);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          animation: 'scaleIn 200ms ease-out',
        }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {currentLevel.icon} {t('level')}体系
          </h2>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* 当前等级 + 进度 */}
        <CurrentLevelCard
          level={currentLevel}
          nextLevel={nextLevel}
          progress={progress}
          points={kpi.currentPoints}
          themeId={themeId as ThemeId}
          accentColor={theme.colors.accent4}
          pointsLabel={t('points')}
        />

        {/* 全部等级一览 */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            {allLevels.filter(l => l.threshold <= kpi.currentPoints).length} / {allLevels.length} 已达成
          </p>
          <div className="space-y-2">
            {allLevels.map((lv, i) => {
              const reached = i <= currentIndex;
              const isCurrent = lv === currentLevel;
              const isNext = lv === nextLevel;
              return (
                <LevelRow
                  key={lv.name}
                  level={lv}
                  index={i}
                  reached={reached}
                  isCurrent={isCurrent}
                  isNext={isNext}
                  accentColor={theme.colors.accent4}
                  points={kpi.currentPoints}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 当前等级卡片：大图标 + 名称 + 进度条 */
function CurrentLevelCard({
  level,
  nextLevel,
  progress,
  points,
  themeId,
  accentColor,
  pointsLabel,
}: {
  level: Level;
  nextLevel: Level | null;
  progress: number;
  points: number;
  themeId: ThemeId;
  accentColor: string;
  pointsLabel: string;
}) {
  return (
    <div
      className="rounded-xl p-5 text-center space-y-3"
      style={{
        background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
        border: `1px solid ${accentColor}30`,
      }}
    >
      <div className="text-5xl">{level.icon}</div>
      <div>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {level.name}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {LEVELS[themeId].filter(l => l.threshold <= points).length} / {LEVELS[themeId].length} 等级
        </p>
      </div>

      {nextLevel ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            <span>{points} {pointsLabel}</span>
            <span>{nextLevel.threshold} {pointsLabel}</span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            距离 {nextLevel.icon} {nextLevel.name} 还需 {nextLevel.threshold - points} {pointsLabel}
          </p>
        </div>
      ) : (
        <div className="py-1">
          <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
            已达满级
          </span>
        </div>
      )}
    </div>
  );
}

/* 单行等级 */
function LevelRow({
  level,
  index,
  reached,
  isCurrent,
  isNext,
  accentColor,
  points,
}: {
  level: Level;
  index: number;
  reached: boolean;
  isCurrent: boolean;
  isNext: boolean;
  accentColor: string;
  points: number;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
      style={{
        backgroundColor: isCurrent ? `${accentColor}12` : 'transparent',
        border: isCurrent ? `1px solid ${accentColor}40` : '1px solid transparent',
        opacity: reached ? 1 : 0.4,
      }}
    >
      {/* 序号 */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{
          backgroundColor: reached ? accentColor : 'var(--bg-secondary)',
          color: reached ? '#fff' : 'var(--text-secondary)',
        }}
      >
        {index + 1}
      </div>

      {/* 图标 + 名称 */}
      <span className={`text-lg ${!reached ? 'grayscale' : ''}`}>{level.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {level.name}
          {isCurrent && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
              当前
            </span>
          )}
          {isNext && (
            <span className="ml-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              下一级
            </span>
          )}
        </p>
      </div>

      {/* 所需积分 */}
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {level.threshold} {reached || isCurrent ? '✓' : ''}
      </span>
    </div>
  );
}
