import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { computeStats } from '@/lib/hooks/useMedalChecker';
import { now } from '@/lib/utils/id';

const childId = 'test-child-medal';
const timestamp = '2026-01-01T00:00:00.000Z';

/** 创建测试用的 child 记录 */
function makeChild(streakDays = 0) {
  return {
    id: childId,
    profile_id: 'profile-1',
    name: '测试学生',
    avatar: '🧑‍🎓',
    grade: '三年级',
    current_points: 0,
    streak_days: streakDays,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

describe('computeStats', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns zeros when no records exist (except streak_days from children table)', async () => {
    await db.children.add(makeChild(7));

    const stats = await computeStats(childId);

    expect(stats.study_hours).toBe(0);
    expect(stats.sport_hours).toBe(0);
    expect(stats.streak_days).toBe(7);
    expect(stats.task_count).toBe(0);
    expect(stats.first_checkin).toBe(0);
    expect(stats.custom).toBe(0);
  });

  it('sums sport_hours correctly (task linked to sport-category subject)', async () => {
    await db.children.add(makeChild());

    // 创建一个运动类科目
    const sportSubjectId = 'sport-subject-1';
    await db.subjects.add({
      id: sportSubjectId,
      child_id: childId,
      name: '跑步',
      icon: '🏃',
      color: '#F97316',
      category: 'sport',
      sort_order: 0,
      created_at: timestamp,
      updated_at: timestamp,
    });

    // 创建关联到运动科目的任务
    const taskId = 'sport-task-1';
    await db.tasks.add({
      id: taskId,
      child_id: childId,
      subject_id: sportSubjectId,
      name: '晨跑',
      content: '跑步30分钟',
      repeat_type: 'daily',
      repeat_days: [1, 2, 3, 4, 5],
      planned_duration_minutes: 30,
      points_reward: 10,
      is_template: false,
      sort_order: 0,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });

    // 添加两条完成记录，各 1800 秒（0.5 小时）
    await db.taskRecords.bulkAdd([
      {
        id: 'rec-1',
        task_id: taskId,
        child_id: childId,
        date: '2026-01-01',
        status: 'completed',
        actual_duration_seconds: 1800,
        is_manual_complete: false,
        created_at: now(),
        updated_at: now(),
      },
      {
        id: 'rec-2',
        task_id: taskId,
        child_id: childId,
        date: '2026-01-02',
        status: 'completed',
        actual_duration_seconds: 1800,
        is_manual_complete: false,
        created_at: now(),
        updated_at: now(),
      },
    ]);

    const stats = await computeStats(childId);

    expect(stats.sport_hours).toBe(1); // 1800 + 1800 = 3600s = 1h
    expect(stats.study_hours).toBe(0);
  });

  it('counts completed tasks for task_count', async () => {
    await db.children.add(makeChild());

    const taskId = 'task-count-1';
    await db.tasks.add({
      id: taskId,
      child_id: childId,
      name: '数学练习',
      content: '',
      repeat_type: 'daily',
      repeat_days: [1, 2, 3, 4, 5],
      planned_duration_minutes: 20,
      points_reward: 5,
      is_template: false,
      sort_order: 0,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });

    await db.taskRecords.bulkAdd([
      {
        id: 'rec-c1',
        task_id: taskId,
        child_id: childId,
        date: '2026-01-01',
        status: 'completed',
        actual_duration_seconds: 600,
        is_manual_complete: false,
        created_at: now(),
        updated_at: now(),
      },
      {
        id: 'rec-c2',
        task_id: taskId,
        child_id: childId,
        date: '2026-01-02',
        status: 'completed',
        actual_duration_seconds: 600,
        is_manual_complete: false,
        created_at: now(),
        updated_at: now(),
      },
      {
        id: 'rec-p1',
        task_id: taskId,
        child_id: childId,
        date: '2026-01-03',
        status: 'pending',
        actual_duration_seconds: 0,
        is_manual_complete: false,
        created_at: now(),
        updated_at: now(),
      },
    ]);

    const stats = await computeStats(childId);

    expect(stats.task_count).toBe(2); // 只有 completed 计入
  });

  it('sets first_checkin to 1 when any completed record exists', async () => {
    await db.children.add(makeChild());

    const taskId = 'task-checkin-1';
    await db.tasks.add({
      id: taskId,
      child_id: childId,
      name: '语文阅读',
      content: '',
      repeat_type: 'daily',
      repeat_days: [1, 2, 3, 4, 5],
      planned_duration_minutes: 15,
      points_reward: 5,
      is_template: false,
      sort_order: 0,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });

    // 先验证没有记录时 first_checkin 为 0
    let stats = await computeStats(childId);
    expect(stats.first_checkin).toBe(0);

    // 添加一条完成记录
    await db.taskRecords.add({
      id: 'rec-fc1',
      task_id: taskId,
      child_id: childId,
      date: '2026-01-01',
      status: 'completed',
      actual_duration_seconds: 300,
      is_manual_complete: false,
      created_at: now(),
      updated_at: now(),
    });

    stats = await computeStats(childId);
    expect(stats.first_checkin).toBe(1);
  });
});
