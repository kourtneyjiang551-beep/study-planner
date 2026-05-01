import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { calculateStreak } from '@/lib/utils/streak';
import { formatDate } from '@/lib/utils/date';
import { now } from '@/lib/utils/id';

/** 返回 n 天前的日期字符串 YYYY-MM-DD */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/** 创建一条 completed 的 task_record */
function makeRecord(childId: string, date: string, taskId = 'task-1') {
  return {
    id: `rec-${date}-${taskId}-${Math.random().toString(36).slice(2, 8)}`,
    task_id: taskId,
    child_id: childId,
    date,
    status: 'completed' as const,
    actual_duration_seconds: 600,
    is_manual_complete: false,
    created_at: now(),
    updated_at: now(),
  };
}

describe('calculateStreak', () => {
  const childId = 'test-child';

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.children.add({
      id: childId,
      profile_id: 'profile-1',
      name: '测试学生',
      avatar: '🧑‍🎓',
      grade: '三年级',
      current_points: 0,
      streak_days: 0,
      created_at: now(),
      updated_at: now(),
    });
  });

  it('没有完成记录时返回 0', async () => {
    const streak = await calculateStreak(childId);
    expect(streak).toBe(0);

    const child = await db.children.get(childId);
    expect(child!.streak_days).toBe(0);
  });

  it('只有今天有完成记录时返回 1', async () => {
    await db.taskRecords.add(makeRecord(childId, daysAgo(0)));

    const streak = await calculateStreak(childId);
    expect(streak).toBe(1);

    const child = await db.children.get(childId);
    expect(child!.streak_days).toBe(1);
  });

  it('连续 3 天有完成记录时返回 3', async () => {
    await db.taskRecords.bulkAdd([
      makeRecord(childId, daysAgo(0)),
      makeRecord(childId, daysAgo(1)),
      makeRecord(childId, daysAgo(2)),
    ]);

    const streak = await calculateStreak(childId);
    expect(streak).toBe(3);

    const child = await db.children.get(childId);
    expect(child!.streak_days).toBe(3);
  });

  it('中间有间断时停止计数（今天+昨天有，前天没有 = 2）', async () => {
    await db.taskRecords.bulkAdd([
      makeRecord(childId, daysAgo(0)),
      makeRecord(childId, daysAgo(1)),
      // daysAgo(2) 缺失
      makeRecord(childId, daysAgo(3)),
    ]);

    const streak = await calculateStreak(childId);
    expect(streak).toBe(2);
  });

  it('今天没有完成记录时返回 0（即使昨天有）', async () => {
    await db.taskRecords.bulkAdd([
      makeRecord(childId, daysAgo(1)),
      makeRecord(childId, daysAgo(2)),
    ]);

    const streak = await calculateStreak(childId);
    expect(streak).toBe(0);
  });

  it('同一天有多条完成记录只计为 1 天', async () => {
    await db.taskRecords.bulkAdd([
      makeRecord(childId, daysAgo(0), 'task-1'),
      makeRecord(childId, daysAgo(0), 'task-2'),
      makeRecord(childId, daysAgo(0), 'task-3'),
    ]);

    const streak = await calculateStreak(childId);
    expect(streak).toBe(1);
  });

  it('非 completed 状态的记录不计入', async () => {
    await db.taskRecords.bulkAdd([
      {
        ...makeRecord(childId, daysAgo(0)),
        status: 'pending' as const,
      },
      {
        ...makeRecord(childId, daysAgo(0)),
        status: 'skipped' as const,
      },
    ]);

    const streak = await calculateStreak(childId);
    expect(streak).toBe(0);
  });

  it('正确更新 children.streak_days 字段', async () => {
    await db.taskRecords.bulkAdd([
      makeRecord(childId, daysAgo(0)),
      makeRecord(childId, daysAgo(1)),
    ]);

    await calculateStreak(childId);
    const child = await db.children.get(childId);
    expect(child!.streak_days).toBe(2);

    // 再次调用仍然得到正确值
    await calculateStreak(childId);
    const child2 = await db.children.get(childId);
    expect(child2!.streak_days).toBe(2);
  });
});
