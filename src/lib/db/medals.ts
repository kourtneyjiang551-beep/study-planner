import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { awardPoints } from '@/lib/utils/points';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import { createClient } from '@/lib/supabase/client';
import type { MedalConditionType, MedalDefinition, MedalUnlock } from '@/types';

export function useMedalDefinitions(childId: string) {
  return useLiveQuery(() => db.medalDefinitions.where({ child_id: childId }).toArray(), [childId]);
}

export function useMedalUnlocks(childId: string) {
  return useLiveQuery(() => db.medalUnlocks.where({ child_id: childId }).toArray(), [childId]);
}

export async function createMedalDefinition(childId: string, data: {
  name: string; description: string; icon: string; color: string;
  condition_type: MedalConditionType; condition_value: number; is_preset: boolean;
}): Promise<string> {
  try {
    const id = generateId();
    const medal: MedalDefinition = { id, child_id: childId, ...data, created_at: now() };
    if (getDataMode() === 'cloud') {
      await cloud.insertMedalDefinition(medal);
    }
    await db.medalDefinitions.add(medal);
    return id;
  } catch (e) { handleDBError('创建勋章', e); }
}

export async function deleteMedalDefinition(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await createClient().from('medal_definitions').delete().eq('id', id);
    }
    await db.transaction('rw', [db.medalDefinitions, db.medalUnlocks], async () => {
      await db.medalUnlocks.where({ medal_definition_id: id }).delete();
      await db.medalDefinitions.delete(id);
    });
  } catch (e) { handleDBError('删除勋章', e); }
}

export async function unlockMedal(childId: string, medalDefId: string) {
  try {
    const existing = await db.medalUnlocks.where('[medal_definition_id+child_id]').equals([medalDefId, childId]).first();
    if (existing) return;
    const medal = await db.medalDefinitions.get(medalDefId);
    if (!medal) return;

    // 确保勋章定义在云端存在
    if (getDataMode() === 'cloud') {
      const exists = await cloud.checkMedalDefinitionExists(medalDefId);
      if (!exists) await cloud.insertMedalDefinition(medal);
    }

    const unlock: MedalUnlock = {
      id: generateId(), medal_definition_id: medalDefId, child_id: childId, unlocked_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await cloud.insertMedalUnlock(unlock);
    }
    await db.medalUnlocks.add(unlock);
    await awardPoints(childId, 10, 'medal_unlock', medalDefId);
  } catch (e) {
    console.error('[DB] 解锁勋章失败:', e);
  }
}
