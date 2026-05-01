import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Grade, SubScore } from '@/types';

export interface GradeFilters {
  subject_id?: string;
  exam_type?: string;
  grade_level?: string;
  semester?: string;
}

export function useGrades(childId: string, filters?: GradeFilters) {
  return useLiveQuery(
    () =>
      db.grades
        .where({ child_id: childId })
        .filter(g => {
          if (filters?.subject_id && g.subject_id !== filters.subject_id) return false;
          if (filters?.exam_type && g.exam_type !== filters.exam_type) return false;
          if (filters?.grade_level && g.grade_level !== filters.grade_level) return false;
          if (filters?.semester && g.semester !== filters.semester) return false;
          return true;
        })
        .toArray()
        .then(r => r.sort((a, b) => b.exam_date.localeCompare(a.exam_date))),
    [childId, filters?.subject_id, filters?.exam_type, filters?.grade_level, filters?.semester],
  );
}

export async function createGrade(childId: string, data: {
  subject_id?: string; exam_name: string; exam_type: string; exam_date: string;
  score: number; total_score: number; target_score?: number;
  class_avg?: number; class_max?: number; class_rank?: number;
  grade_rank?: number; semester: string; grade_level: string; sub_scores?: SubScore[];
}): Promise<string> {
  try {
    const id = generateId();
    const grade: Grade = { id, child_id: childId, ...data, created_at: now(), updated_at: now() };
    if (getDataMode() === 'cloud') {
      await cloud.insertGrade(grade);
    }
    await db.grades.add(grade);
    return id;
  } catch (e) { handleDBError('添加成绩', e); }
}

export async function updateGrade(id: string, data: Partial<Omit<Grade, 'id' | 'child_id' | 'created_at' | 'updated_at'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateGradeCloud(id, data);
    }
    await db.grades.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新成绩', e); }
}

export async function deleteGrade(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteGradeCloud(id);
    }
    await db.grades.delete(id);
  } catch (e) { handleDBError('删除成绩', e); }
}
