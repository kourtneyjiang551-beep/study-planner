import { db } from './database';
import { createClient } from '@/lib/supabase/client';

export interface MigrationResult {
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
  recordCount?: number;
}

export async function hasLocalData(): Promise<boolean> {
  const children = await db.children.count();
  return children > 0;
}

export async function hasCloudData(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('children').select('id').eq('user_id', userId).limit(1);
  return (data?.length ?? 0) > 0;
}

async function readAllLocalData() {
  const [profile] = await db.profiles.toArray();
  const children = await db.children.toArray();
  const subjects = await db.subjects.toArray();
  const tasks = await db.tasks.toArray();
  const taskRecords = await db.taskRecords.toArray();
  const grades = await db.grades.toArray();
  const medalDefinitions = await db.medalDefinitions.toArray();
  const medalUnlocks = await db.medalUnlocks.toArray();
  const rewards = await db.rewards.toArray();
  const rewardRedemptions = await db.rewardRedemptions.toArray();
  const pointsLog = await db.pointsLog.toArray();

  const totalCount = children.length + subjects.length + tasks.length +
    taskRecords.length + grades.length + medalDefinitions.length +
    medalUnlocks.length + rewards.length + rewardRedemptions.length + pointsLog.length;

  return {
    profile, children, subjects, tasks, taskRecords, grades,
    medalDefinitions, medalUnlocks, rewards, rewardRedemptions, pointsLog,
    totalCount,
  };
}

export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  const cloudHasData = await hasCloudData(userId);
  if (cloudHasData) {
    return { status: 'skipped', reason: '云端已有数据' };
  }

  const localData = await readAllLocalData();
  if (localData.totalCount === 0) {
    return { status: 'skipped', reason: '本地无数据' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('migrate_local_data', {
    payload: {
      profile: localData.profile ?? {},
      children: localData.children,
      subjects: localData.subjects,
      tasks: localData.tasks,
      taskRecords: localData.taskRecords,
      grades: localData.grades,
      medalDefinitions: localData.medalDefinitions,
      medalUnlocks: localData.medalUnlocks,
      rewards: localData.rewards,
      rewardRedemptions: localData.rewardRedemptions,
      pointsLog: localData.pointsLog,
    },
  });

  if (error) {
    console.error('[Migration] 迁移失败:', error);
    return { status: 'failed', error: error.message };
  }

  await db.syncQueue.clear();
  return { status: 'success', recordCount: localData.totalCount };
}
