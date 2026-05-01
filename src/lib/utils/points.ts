import { db } from '@/lib/db/database';
import { generateId, now } from '@/lib/utils/id';
import type { PointsSource, PointsType } from '@/types';

/**
 * 原子性积分操作 -- 使用 Dexie 事务保证 children.current_points 与 points_log 一致
 *
 * @param childId  孩子 ID
 * @param amount   积分数（正数=获得，负数=消耗）
 * @param source   来源类型
 * @param sourceId 来源记录 ID（如 task_record.id / reward.id）
 */
export async function awardPoints(
  childId: string,
  amount: number,
  source: PointsSource,
  sourceId?: string,
) {
  await db.transaction('rw', [db.children, db.pointsLog], async () => {
    const child = await db.children.get(childId);
    if (!child) throw new Error('Child not found');

    // 原子更新余额
    await db.children.update(childId, {
      current_points: child.current_points + amount,
      updated_at: now(),
    });

    // 写入流水
    const type: PointsType = amount > 0 ? 'earn' : 'spend';
    await db.pointsLog.add({
      id: generateId(),
      child_id: childId,
      amount,
      type,
      source,
      source_id: sourceId,
      description: descriptionForSource(source, amount),
      created_at: now(),
    });
  });
}

export function descriptionForSource(source: PointsSource, amount: number): string {
  switch (source) {
    case 'task_complete':
      return `完成任务获得 ${amount} 积分`;
    case 'medal_unlock':
      return `解锁勋章获得 ${amount} 积分`;
    case 'reward_redeem':
      return `兑换奖励消耗 ${Math.abs(amount)} 积分`;
    default:
      return `积分变动 ${amount}`;
  }
}
