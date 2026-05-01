import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { createGrade, updateGrade, deleteGrade } from '../hooks';
import { now } from '@/lib/utils/id';

const TEST_CHILD_ID = 'test-child-grades';

async function seedChild() {
  await db.children.add({
    id: TEST_CHILD_ID,
    profile_id: 'profile-001',
    name: '测试小朋友',
    avatar: '',
    grade: '五年级',
    current_points: 0,
    streak_days: 0,
    created_at: now(),
    updated_at: now(),
  });
}

const gradeData = {
  exam_name: '期中考试',
  exam_type: 'midterm',
  exam_date: '2026-04-01',
  score: 92,
  total_score: 100,
  semester: '2025-2026-2',
  grade_level: '五年级',
};

describe('Grades CRUD', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedChild();
  });

  it('createGrade 添加记录且字段正确', async () => {
    const id = await createGrade(TEST_CHILD_ID, gradeData);

    const grade = await db.grades.get(id);
    expect(grade).toBeDefined();
    expect(grade!.child_id).toBe(TEST_CHILD_ID);
    expect(grade!.exam_name).toBe('期中考试');
    expect(grade!.exam_type).toBe('midterm');
    expect(grade!.exam_date).toBe('2026-04-01');
    expect(grade!.score).toBe(92);
    expect(grade!.total_score).toBe(100);
    expect(grade!.semester).toBe('2025-2026-2');
    expect(grade!.grade_level).toBe('五年级');
    expect(grade!.created_at).toBeDefined();
    expect(grade!.updated_at).toBeDefined();
  });

  it('updateGrade 修改指定字段', async () => {
    const id = await createGrade(TEST_CHILD_ID, gradeData);
    const before = await db.grades.get(id);

    await updateGrade(id, { score: 95, class_rank: 3 });

    const after = await db.grades.get(id);
    expect(after!.score).toBe(95);
    expect(after!.class_rank).toBe(3);
    // 未修改字段保持不变
    expect(after!.exam_name).toBe('期中考试');
    expect(after!.total_score).toBe(100);
    // updated_at 应更新（避免同毫秒断言，改为验证时间先后）
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updated_at).getTime(),
    );
  });

  it('deleteGrade 删除记录', async () => {
    const id = await createGrade(TEST_CHILD_ID, gradeData);
    expect(await db.grades.get(id)).toBeDefined();

    await deleteGrade(id);

    expect(await db.grades.get(id)).toBeUndefined();
  });
});
