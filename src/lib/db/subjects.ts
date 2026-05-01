import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Subject, SubjectCategory } from '@/types';

export function useSubjects(childId: string) {
  return useLiveQuery(
    () => db.subjects.where({ child_id: childId }).sortBy('sort_order'),
    [childId],
  );
}

export async function createSubject(childId: string, data: { name: string; color: string; icon: string; category: SubjectCategory }): Promise<string> {
  try {
    const id = generateId();
    const count = await db.subjects.where({ child_id: childId }).count();
    const subject: Subject = {
      id, child_id: childId, name: data.name, color: data.color,
      icon: data.icon, category: data.category, sort_order: count,
      created_at: now(), updated_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await cloud.insertSubject(subject);
    }
    await db.subjects.add(subject);
    return id;
  } catch (e) { handleDBError('创建科目', e); }
}

export async function updateSubject(id: string, data: Partial<Pick<Subject, 'name' | 'color' | 'icon' | 'category' | 'sort_order'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateSubjectCloud(id, data);
    }
    await db.subjects.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新科目', e); }
}

export async function deleteSubject(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteSubjectCloud(id);
    }
    await db.transaction('rw', [db.subjects, db.tasks, db.grades], async () => {
      const tasks = await db.tasks.where({ subject_id: id }).toArray();
      for (const task of tasks) await db.tasks.update(task.id, { subject_id: undefined, updated_at: now() });
      const grades = await db.grades.where({ subject_id: id }).toArray();
      for (const grade of grades) await db.grades.update(grade.id, { subject_id: undefined, updated_at: now() });
      await db.subjects.delete(id);
    });
  } catch (e) { handleDBError('删除科目', e); }
}
