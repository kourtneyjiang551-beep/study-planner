import type { ThemeId } from '@/types';

export interface Level {
  name: string;
  icon: string;
  threshold: number;
}

export const LEVELS: Record<ThemeId, Level[]> = {
  dojo: [
    { name: '白带', icon: '🤍', threshold: 0 },
    { name: '黄带', icon: '💛', threshold: 50 },
    { name: '绿带', icon: '💚', threshold: 150 },
    { name: '蓝带', icon: '💙', threshold: 300 },
    { name: '棕带', icon: '🤎', threshold: 600 },
    { name: '黑带初段', icon: '🖤', threshold: 1000 },
    { name: '黑带三段', icon: '🏆', threshold: 2000 },
  ],
  magic: [
    { name: '见习法师', icon: '✨', threshold: 0 },
    { name: '初级法师', icon: '🔮', threshold: 50 },
    { name: '中级法师', icon: '⚡', threshold: 150 },
    { name: '高级法师', icon: '💫', threshold: 300 },
    { name: '大法师', icon: '🎩', threshold: 600 },
    { name: '魔导师', icon: '🧙', threshold: 1000 },
    { name: '传奇法师', icon: '👑', threshold: 2000 },
  ],
  garden: [
    { name: '播种者', icon: '🌱', threshold: 0 },
    { name: '小花匠', icon: '🌷', threshold: 50 },
    { name: '园艺师', icon: '🌻', threshold: 150 },
    { name: '花艺大师', icon: '🌺', threshold: 300 },
    { name: '植物学家', icon: '🌳', threshold: 600 },
    { name: '花园守护者', icon: '🌿', threshold: 1000 },
    { name: '自然之主', icon: '🏡', threshold: 2000 },
  ],
  ocean: [
    { name: '浮潜新手', icon: '🐚', threshold: 0 },
    { name: '珊瑚探索者', icon: '🐠', threshold: 50 },
    { name: '深海潜水员', icon: '🐬', threshold: 150 },
    { name: '海洋猎人', icon: '🦈', threshold: 300 },
    { name: '航海家', icon: '⛵', threshold: 600 },
    { name: '海洋守望者', icon: '🐋', threshold: 1000 },
    { name: '深渊之主', icon: '🔱', threshold: 2000 },
  ],
};

/** 获取当前等级 */
export function getLevel(themeId: ThemeId, points: number): Level {
  const levels = LEVELS[themeId];
  let current = levels[0];
  for (const lv of levels) {
    if (points >= lv.threshold) current = lv;
    else break;
  }
  return current;
}

/** 获取下一等级（已满级返回 null） */
export function getNextLevel(themeId: ThemeId, points: number): Level | null {
  const levels = LEVELS[themeId];
  for (const lv of levels) {
    if (points < lv.threshold) return lv;
  }
  return null;
}

/** 计算到下一级的进度百分比 (0-100) */
export function getLevelProgress(themeId: ThemeId, points: number): number {
  const current = getLevel(themeId, points);
  const next = getNextLevel(themeId, points);
  if (!next) return 100;
  const range = next.threshold - current.threshold;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((points - current.threshold) / range) * 100));
}
