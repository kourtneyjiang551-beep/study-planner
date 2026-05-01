import { db } from '@/lib/db/database';
import { formatDate } from '@/lib/utils/date';
import { now } from '@/lib/utils/id';

/**
 * 计算连续打卡天数并更新 children 表
 * 批量查询全部已完成记录，内存中倒推连续天数
 */
export async function calculateStreak(childId: string): Promise<number> {
  // 单次查询该 child 所有 completed 记录的日期
  const records = await db.taskRecords
    .where({ child_id: childId })
    .filter(r => r.status === 'completed')
    .toArray();

  const completedDates = new Set(records.map(r => r.date));

  // 从今天往回逐天检查
  let streak = 0;
  const checkDate = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(checkDate);
    if (completedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  await db.children.update(childId, {
    streak_days: streak,
    updated_at: now(),
  });

  return streak;
}
