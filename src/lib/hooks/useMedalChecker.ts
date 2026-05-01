import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { unlockMedal } from '@/lib/db/hooks';
import type { MedalConditionType } from '@/types';

/**
 * 勋章自动解锁检测器
 * 每次完成任务后调用 checkMedals()，检查所有未解锁勋章的条件
 */
export function useMedalChecker(childId: string) {
  const checkMedals = useCallback(async () => {
    // 获取所有勋章定义和已解锁记录
    const [definitions, unlocks] = await Promise.all([
      db.medalDefinitions.where({ child_id: childId }).toArray(),
      db.medalUnlocks.where({ child_id: childId }).toArray(),
    ]);

    const unlockedSet = new Set(unlocks.map(u => u.medal_definition_id));
    const locked = definitions.filter(d => !unlockedSet.has(d.id));
    if (locked.length === 0) return [];

    // 计算各类条件的当前值
    const stats = await computeStats(childId);

    const newlyUnlocked: string[] = [];
    for (const medal of locked) {
      const current = stats[medal.condition_type] ?? 0;
      if (current >= medal.condition_value) {
        await unlockMedal(childId, medal.id);
        newlyUnlocked.push(medal.name);
      }
    }

    return newlyUnlocked;
  }, [childId]);

  return { checkMedals };
}

/** 计算勋章条件所需的统计数据 */
export async function computeStats(childId: string): Promise<Record<MedalConditionType, number>> {
  const [records, subjects, child] = await Promise.all([
    db.taskRecords.where({ child_id: childId }).filter(r => r.status === 'completed').toArray(),
    db.subjects.where({ child_id: childId }).toArray(),
    db.children.get(childId),
  ]);

  const subjectCategory = new Map<string, string>();
  for (const s of subjects) subjectCategory.set(s.id, s.category);

  const taskIds = [...new Set(records.map(r => r.task_id))];
  const tasks = taskIds.length > 0 ? await db.tasks.where('id').anyOf(taskIds).toArray() : [];
  const taskSubjectMap = new Map<string, string | undefined>();
  for (const t of tasks) taskSubjectMap.set(t.id, t.subject_id);

  let studySeconds = 0;
  let sportSeconds = 0;

  for (const r of records) {
    const subjectId = taskSubjectMap.get(r.task_id);
    const category = subjectId ? subjectCategory.get(subjectId) ?? 'academic' : 'academic';

    if (category === 'sport') {
      sportSeconds += r.actual_duration_seconds;
    } else {
      studySeconds += r.actual_duration_seconds;
    }
  }

  return {
    study_hours: studySeconds / 3600,
    sport_hours: sportSeconds / 3600,
    streak_days: child?.streak_days ?? 0,
    task_count: records.length,
    first_checkin: records.length > 0 ? 1 : 0,
    custom: 0,
  };
}

const EMPTY_STATS: Record<MedalConditionType, number> = {
  study_hours: 0, sport_hours: 0, streak_days: 0, task_count: 0, first_checkin: 0, custom: 0,
};

/** 实时获取勋章统计数据，用于显示进度条 */
export function useMedalStats(childId: string) {
  return useLiveQuery(
    () => computeStats(childId),
    [childId],
    EMPTY_STATS,
  );
}
