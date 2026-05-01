import { db } from './database';
import { createClient } from '@/lib/supabase/client';
import { fetchAllDataForUser } from './supabase-queries';

export async function pullCloudToLocal(userId: string): Promise<void> {
  const data = await fetchAllDataForUser(userId);
  if (!data) return;

  // 将嵌套的 childDataList 展平为平铺数组
  const subjects = data.childDataList.flatMap(d => d.subjects);
  const tasks = data.childDataList.flatMap(d => d.tasks);
  const grades = data.childDataList.flatMap(d => d.grades);
  const medalDefinitions = data.childDataList.flatMap(d => d.medalDefinitions);
  const medalUnlocks = data.childDataList.flatMap(d => d.medalUnlocks);
  const rewards = data.childDataList.flatMap(d => d.rewards);
  const rewardRedemptions = data.childDataList.flatMap(d => d.rewardRedemptions);
  const pointsLog = data.childDataList.flatMap(d => d.pointsLog);

  await db.transaction('rw',
    [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
     db.grades, db.medalDefinitions, db.medalUnlocks,
     db.rewards, db.rewardRedemptions, db.pointsLog],
    async () => {
      await db.profiles.clear();
      await db.children.clear();
      await db.subjects.clear();
      await db.tasks.clear();
      await db.taskRecords.clear();
      await db.grades.clear();
      await db.medalDefinitions.clear();
      await db.medalUnlocks.clear();
      await db.rewards.clear();
      await db.rewardRedemptions.clear();
      await db.pointsLog.clear();

      if (data.profile) await db.profiles.add(data.profile);
      if (data.children.length) await db.children.bulkAdd(data.children);
      if (subjects.length) await db.subjects.bulkAdd(subjects);
      if (tasks.length) await db.tasks.bulkAdd(tasks);
      if (grades.length) await db.grades.bulkAdd(grades);
      if (medalDefinitions.length) await db.medalDefinitions.bulkAdd(medalDefinitions);
      if (medalUnlocks.length) await db.medalUnlocks.bulkAdd(medalUnlocks);
      if (rewards.length) await db.rewards.bulkAdd(rewards);
      if (rewardRedemptions.length) await db.rewardRedemptions.bulkAdd(rewardRedemptions);
      if (pointsLog.length) await db.pointsLog.bulkAdd(pointsLog);
    },
  );
}

export async function processSyncQueue(): Promise<number> {
  const items = await db.syncQueue.orderBy('created_at').toArray();
  if (items.length === 0) return 0;

  const supabase = createClient();
  let processed = 0;

  for (const item of items) {
    try {
      if (item.operation === 'upsert') {
        const { error } = await supabase.from(item.table).upsert(item.payload);
        if (error) throw error;
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.record_id);
        if (error) throw error;
      }
      await db.syncQueue.delete(item.id);
      processed++;
    } catch (e) {
      console.error(`[Sync] 同步失败 (${item.table}/${item.record_id}):`, e);
      if (item.retries >= 5) {
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, { retries: item.retries + 1 });
      }
    }
  }

  return processed;
}

/**
 * 清除所有本地 IndexedDB 数据（登出时调用）
 */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw',
    [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
     db.grades, db.medalDefinitions, db.medalUnlocks,
     db.rewards, db.rewardRedemptions, db.pointsLog, db.syncQueue],
    async () => {
      await db.profiles.clear();
      await db.children.clear();
      await db.subjects.clear();
      await db.tasks.clear();
      await db.taskRecords.clear();
      await db.grades.clear();
      await db.medalDefinitions.clear();
      await db.medalUnlocks.clear();
      await db.rewards.clear();
      await db.rewardRedemptions.clear();
      await db.pointsLog.clear();
      await db.syncQueue.clear();
    },
  );
}
