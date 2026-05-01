import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { today } from '@/lib/utils/date';

export interface KPIData {
  /** 今日学习时间（秒） */
  studySeconds: number;
  /** 今日运动/户外时间（秒） */
  sportSeconds: number;
  /** 今日已完成任务数 */
  completedCount: number;
  /** 今日任务总数 */
  totalCount: number;
  /** 完成进度百分比 0-100 */
  progressPercent: number;
  /** 当前积分余额 */
  currentPoints: number;
  /** 已解锁勋章数 */
  medalCount: number;
}

const EMPTY: KPIData = {
  studySeconds: 0,
  sportSeconds: 0,
  completedCount: 0,
  totalCount: 0,
  progressPercent: 0,
  currentPoints: 0,
  medalCount: 0,
};

export function useKPI(childId: string): KPIData {
  const data = useLiveQuery(async () => {
    const todayStr = today();

    // 并行查询：当日记录、科目、孩子信息、勋章
    const [records, subjects, child, medalUnlocks] = await Promise.all([
      db.taskRecords.where({ child_id: childId, date: todayStr }).toArray(),
      db.subjects.where({ child_id: childId }).toArray(),
      db.children.get(childId),
      db.medalUnlocks.where({ child_id: childId }).toArray(),
    ]);

    if (!records.length && !child) return EMPTY;

    // 构建 subject category 查找表
    const subjectCategory = new Map<string, string>();
    for (const s of subjects) {
      subjectCategory.set(s.id, s.category);
    }

    // 获取所有关联 task 的 subject_id
    const taskIds = [...new Set(records.map(r => r.task_id))];
    const tasks = await db.tasks.where('id').anyOf(taskIds).toArray();
    const taskSubjectMap = new Map<string, string | undefined>();
    for (const t of tasks) {
      taskSubjectMap.set(t.id, t.subject_id);
    }

    // 按科目分类累计时间
    let studySeconds = 0;
    let sportSeconds = 0;
    let completedCount = 0;

    for (const r of records) {
      const subjectId = taskSubjectMap.get(r.task_id);
      const category = subjectId ? subjectCategory.get(subjectId) : 'academic';

      // 累计实际用时（含正在计时的）
      let duration = r.actual_duration_seconds;
      if (r.status === 'in_progress' && r.started_at) {
        duration += Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000);
      }

      if (category === 'sport') {
        sportSeconds += duration;
      } else if (category !== 'entertainment') {
        studySeconds += duration;
      }
      // entertainment 不计入学习或运动时间

      if (r.status === 'completed') {
        completedCount++;
      }
    }

    const totalCount = records.length;
    const progressPercent = totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

    return {
      studySeconds,
      sportSeconds,
      completedCount,
      totalCount,
      progressPercent,
      currentPoints: child?.current_points ?? 0,
      medalCount: medalUnlocks.length,
    };
  }, [childId]);

  return data ?? EMPTY;
}
