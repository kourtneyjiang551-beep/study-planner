import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Child } from '@/types';

export function useChildren(profileId: string) {
  return useLiveQuery(
    () => db.children.where({ profile_id: profileId }).toArray(),
    [profileId],
  );
}

export async function createChild(profileId: string, data: { name: string; grade: string }, userId?: string): Promise<string> {
  try {
    const id = generateId();
    const timestamp = now();
    const child: Child = {
      id, profile_id: profileId, name: data.name, avatar: '', grade: data.grade,
      current_points: 0, streak_days: 0, created_at: timestamp, updated_at: timestamp,
      ...(userId ? { user_id: userId } : {}),
    };
    if (getDataMode() === 'cloud') {
      await cloud.insertChild(child);
    }
    await db.children.add(child);
    return id;
  } catch (e) { handleDBError('创建孩子', e); }
}

export async function updateChild(id: string, data: Partial<Pick<Child, 'name' | 'grade' | 'avatar'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateChildCloud(id, data);
    }
    await db.children.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新孩子信息', e); }
}

export async function deleteChild(childId: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteChildCloud(childId);
    }
    await db.transaction('rw',
      [db.children, db.subjects, db.tasks, db.taskRecords, db.grades,
       db.medalDefinitions, db.medalUnlocks, db.rewards, db.rewardRedemptions, db.pointsLog],
      async () => {
        await db.pointsLog.where({ child_id: childId }).delete();
        await db.rewardRedemptions.where({ child_id: childId }).delete();
        await db.rewards.where({ child_id: childId }).delete();
        await db.medalUnlocks.where({ child_id: childId }).delete();
        await db.medalDefinitions.where({ child_id: childId }).delete();
        await db.grades.where({ child_id: childId }).delete();
        await db.taskRecords.where({ child_id: childId }).delete();
        await db.tasks.where({ child_id: childId }).delete();
        await db.subjects.where({ child_id: childId }).delete();
        await db.children.delete(childId);
      },
    );
  } catch (e) { handleDBError('删除孩子', e); }
}
