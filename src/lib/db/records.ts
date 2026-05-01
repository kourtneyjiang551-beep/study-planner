import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { getDayOfWeek } from '@/lib/utils/date';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Task, TaskRecord } from '@/types';

function shouldTaskAppearOnDay(task: Task, dayOfWeek: number): boolean {
  if (!task.is_active || task.is_template) return false;
  if (task.repeat_type === 'once') return getDayOfWeek(task.created_at.slice(0, 10)) === dayOfWeek;
  return (task.repeat_days ?? []).includes(dayOfWeek);
}

export function useTaskRecords(childId: string, date: string) {
  return useLiveQuery(
    () => db.taskRecords.where({ child_id: childId, date }).toArray(),
    [childId, date],
  );
}

export async function ensureTaskRecordsForDate(childId: string, date: string) {
  try {
    const dayOfWeek = getDayOfWeek(date);
    const tasks = await db.tasks.where({ child_id: childId }).filter(t => t.is_active && !t.is_template).toArray();
    for (const task of tasks) {
      if (!shouldTaskAppearOnDay(task, dayOfWeek)) continue;
      if (task.repeat_type === 'once' && task.created_at.slice(0, 10) !== date) continue;
      const existing = await db.taskRecords.where('[task_id+date]').equals([task.id, date]).first();
      if (!existing) {
        const ts = now();
        const record: TaskRecord = {
          id: generateId(), task_id: task.id, child_id: childId, date,
          status: 'pending', actual_duration_seconds: 0, is_manual_complete: false,
          created_at: ts, updated_at: ts,
        };
        if (getDataMode() === 'cloud') {
          await cloud.upsertTaskRecord(record);
        }
        await db.taskRecords.put(record);
      }
    }
  } catch (e) {
    console.error('[DB] 生成任务记录失败:', e);
  }
}

export function useOverdueRecords(childId: string, todayStr: string) {
  return useLiveQuery(async () => {
    const sevenDaysAgo = new Date(todayStr);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);
    return db.taskRecords
      .where({ child_id: childId })
      .filter(r => r.date >= startDate && r.date < todayStr && r.status === 'pending')
      .toArray();
  }, [childId, todayStr]);
}
