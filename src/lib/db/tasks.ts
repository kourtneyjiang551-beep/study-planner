import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { getDayOfWeek } from '@/lib/utils/date';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Task, RepeatType } from '@/types';

/** 确保关联数据在云端存在，不存在则从本地同步 */
async function ensureSubjectInCloud(subjectId: string | undefined) {
  if (!subjectId || getDataMode() !== 'cloud') return;
  const exists = await cloud.checkSubjectExists(subjectId);
  if (!exists) {
    const local = await db.subjects.get(subjectId);
    if (local) await cloud.insertSubject(local);
  }
}

export function useTasks(childId: string) {
  return useLiveQuery(
    () => db.tasks.where('[child_id+is_active]').equals([childId, 1]).sortBy('sort_order'),
    [childId],
  );
}

export function useActiveTasks(childId: string) {
  return useLiveQuery(
    () => db.tasks.where({ child_id: childId }).filter(t => t.is_active && !t.is_template).sortBy('sort_order'),
    [childId],
  );
}

export function useTemplates(childId: string) {
  return useLiveQuery(
    () => db.tasks.where({ child_id: childId }).filter(t => t.is_template && t.is_active).sortBy('sort_order'),
    [childId],
  );
}

export async function createTask(
  childId: string,
  data: {
    name: string; subject_id?: string; content?: string;
    repeat_type: RepeatType; repeat_days?: number[];
    planned_duration_minutes: number; planned_time_start?: string;
    planned_time_end?: string; points_reward: number;
  },
): Promise<string> {
  try {
    const id = generateId();
    const count = await db.tasks.where({ child_id: childId }).count();
    let repeatDays = data.repeat_days ?? [];
    if (data.repeat_type === 'daily') repeatDays = [1, 2, 3, 4, 5, 6, 7];
    if (data.repeat_type === 'weekdays') repeatDays = [1, 2, 3, 4, 5];
    const task: Task = {
      id, child_id: childId, subject_id: data.subject_id, name: data.name,
      content: data.content ?? '', repeat_type: data.repeat_type, repeat_days: repeatDays,
      planned_duration_minutes: data.planned_duration_minutes,
      planned_time_start: data.planned_time_start, planned_time_end: data.planned_time_end,
      points_reward: data.points_reward, is_template: false, sort_order: count,
      is_active: true, created_at: now(), updated_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await ensureSubjectInCloud(data.subject_id);
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
    return id;
  } catch (e) { handleDBError('创建任务', e); }
}

export async function updateTask(id: string, data: Partial<Pick<Task, 'name' | 'subject_id' | 'content' | 'repeat_type' | 'repeat_days' | 'planned_duration_minutes' | 'planned_time_start' | 'planned_time_end' | 'points_reward' | 'sort_order'>>) {
  try {
    const patch = { ...data };
    if (patch.repeat_type) {
      if (patch.repeat_type === 'daily') patch.repeat_days = [1, 2, 3, 4, 5, 6, 7];
      else if (patch.repeat_type === 'weekdays') patch.repeat_days = [1, 2, 3, 4, 5];
      else if (patch.repeat_type === 'once') patch.repeat_days = [];
    }
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, patch);
    }
    await db.tasks.update(id, { ...patch, updated_at: now() });
  } catch (e) { handleDBError('更新任务', e); }
}

export async function deleteTask(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, { is_active: false });
    }
    await db.tasks.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除任务', e); }
}

export async function createTemplate(
  childId: string,
  data: { name: string; content?: string; subject_id?: string; repeat_type: RepeatType; repeat_days?: number[]; planned_duration_minutes: number; planned_time_start?: string; planned_time_end?: string; points_reward: number },
) {
  try {
    const task: Task = {
      id: generateId(), child_id: childId, ...data, content: data.content ?? '',
      repeat_days: data.repeat_days ?? [], is_template: true, is_preset: false, sort_order: Date.now(),
      is_active: true, created_at: now(), updated_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await ensureSubjectInCloud(data.subject_id);
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
  } catch (e) { handleDBError('创建模板', e); }
}

export async function deleteTemplate(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, { is_active: false });
    }
    await db.tasks.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除模板', e); }
}

/** 从预置数据创建模板（按名称去重） */
export async function createTemplateFromPreset(
  childId: string,
  preset: { name: string; content: string; repeat_type: RepeatType; planned_duration_minutes: number; points_reward: number },
) {
  try {
    const existing = await db.tasks.where({ child_id: childId })
      .filter(t => t.is_template && t.is_active && t.name === preset.name).first();
    if (existing) return;

    const repeatDays = preset.repeat_type === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
    const task: Task = {
      id: generateId(), child_id: childId, name: preset.name, content: preset.content,
      repeat_type: preset.repeat_type, repeat_days: repeatDays,
      planned_duration_minutes: preset.planned_duration_minutes,
      points_reward: preset.points_reward,
      is_template: true, is_preset: true, sort_order: Date.now(),
      is_active: true, created_at: now(), updated_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
  } catch (e) { handleDBError('添加预置模板', e); }
}
