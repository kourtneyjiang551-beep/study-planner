import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database';
import { ensureTaskRecordsForDate } from '../hooks';
import type { Task } from '@/types';

const CHILD_ID = 'child-001';
// 2026-04-03 是周五 (dayOfWeek=5)，2026-04-04 是周六 (dayOfWeek=6)
const FRIDAY = '2026-04-03';
const SATURDAY = '2026-04-04';
const MONDAY = '2026-03-30'; // dayOfWeek=1
const SUNDAY = '2026-04-05'; // dayOfWeek=7

/** 创建一个任务并写入数据库 */
async function insertTask(overrides: Partial<Task> = {}): Promise<Task> {
  const task: Task = {
    id: 'task-' + Math.random().toString(36).slice(2, 8),
    child_id: CHILD_ID,
    name: '测试任务',
    content: '',
    repeat_type: 'daily',
    repeat_days: [1, 2, 3, 4, 5, 6, 7],
    planned_duration_minutes: 30,
    points_reward: 5,
    is_template: false,
    sort_order: 0,
    is_active: true,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
  await db.tasks.add(task);
  return task;
}

describe('ensureTaskRecordsForDate', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();

    // 插入一个 child
    await db.children.add({
      id: CHILD_ID,
      profile_id: 'profile-001',
      name: '小明',
      avatar: '',
      grade: '三年级',
      current_points: 0,
      streak_days: 0,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    });
  });

  it('daily 任务为任意一天生成记录', async () => {
    await insertTask({
      id: 'task-daily',
      repeat_type: 'daily',
      repeat_days: [1, 2, 3, 4, 5, 6, 7],
    });

    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    const records = await db.taskRecords.where({ child_id: CHILD_ID, date: FRIDAY }).toArray();
    expect(records).toHaveLength(1);
    expect(records[0].task_id).toBe('task-daily');
    expect(records[0].status).toBe('pending');
  });

  it('weekdays 任务在周一至周五生成记录', async () => {
    await insertTask({
      id: 'task-weekdays',
      repeat_type: 'weekdays',
      repeat_days: [1, 2, 3, 4, 5],
    });

    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    const fridayRecords = await db.taskRecords
      .where({ child_id: CHILD_ID, date: FRIDAY })
      .toArray();
    expect(fridayRecords).toHaveLength(1);
  });

  it('weekdays 任务不在周六/周日生成记录', async () => {
    await insertTask({
      id: 'task-weekdays-2',
      repeat_type: 'weekdays',
      repeat_days: [1, 2, 3, 4, 5],
    });

    await ensureTaskRecordsForDate(CHILD_ID, SATURDAY);
    const satRecords = await db.taskRecords
      .where({ child_id: CHILD_ID, date: SATURDAY })
      .toArray();
    expect(satRecords).toHaveLength(0);

    await ensureTaskRecordsForDate(CHILD_ID, SUNDAY);
    const sunRecords = await db.taskRecords
      .where({ child_id: CHILD_ID, date: SUNDAY })
      .toArray();
    expect(sunRecords).toHaveLength(0);
  });

  it('once 任务只在创建当天生成记录', async () => {
    // created_at 对应周五
    await insertTask({
      id: 'task-once',
      repeat_type: 'once',
      repeat_days: [],
      created_at: '2026-04-03T10:00:00.000Z',
    });

    // 周五（创建日）应该生成
    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    const fridayRecords = await db.taskRecords
      .where({ child_id: CHILD_ID, date: FRIDAY })
      .toArray();
    expect(fridayRecords).toHaveLength(1);

    // 周六不应该生成
    await ensureTaskRecordsForDate(CHILD_ID, SATURDAY);
    const satRecords = await db.taskRecords
      .where({ child_id: CHILD_ID, date: SATURDAY })
      .toArray();
    expect(satRecords).toHaveLength(0);
  });

  it('once 任务不会在非创建日但同一星期几的日期生成记录', async () => {
    // created_at 是 2026-04-03 周五
    await insertTask({
      id: 'task-once-other-friday',
      repeat_type: 'once',
      repeat_days: [],
      created_at: '2026-04-03T10:00:00.000Z',
    });

    // 下一个周五 2026-04-10 不应生成
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-10');
    const records = await db.taskRecords
      .where({ child_id: CHILD_ID, date: '2026-04-10' })
      .toArray();
    expect(records).toHaveLength(0);
  });

  it('custom repeat_days 被正确遵守', async () => {
    // 只在周一和周五
    await insertTask({
      id: 'task-custom',
      repeat_type: 'custom',
      repeat_days: [1, 5],
    });

    // 周五应该生成
    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    expect(
      await db.taskRecords.where({ child_id: CHILD_ID, date: FRIDAY }).count(),
    ).toBe(1);

    // 周一应该生成
    await ensureTaskRecordsForDate(CHILD_ID, MONDAY);
    expect(
      await db.taskRecords.where({ child_id: CHILD_ID, date: MONDAY }).count(),
    ).toBe(1);

    // 周六不应该生成
    await ensureTaskRecordsForDate(CHILD_ID, SATURDAY);
    expect(
      await db.taskRecords.where({ child_id: CHILD_ID, date: SATURDAY }).count(),
    ).toBe(0);
  });

  it('幂等 — 多次调用不会创建重复记录', async () => {
    await insertTask({ id: 'task-idempotent' });

    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);

    const records = await db.taskRecords
      .where({ child_id: CHILD_ID, date: FRIDAY })
      .toArray();
    expect(records).toHaveLength(1);
  });

  it('非活跃任务 (is_active: false) 被跳过', async () => {
    await insertTask({
      id: 'task-inactive',
      is_active: false,
    });

    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    const records = await db.taskRecords
      .where({ child_id: CHILD_ID, date: FRIDAY })
      .toArray();
    expect(records).toHaveLength(0);
  });

  it('模板任务 (is_template: true) 被跳过', async () => {
    await insertTask({
      id: 'task-template',
      is_template: true,
    });

    await ensureTaskRecordsForDate(CHILD_ID, FRIDAY);
    const records = await db.taskRecords
      .where({ child_id: CHILD_ID, date: FRIDAY })
      .toArray();
    expect(records).toHaveLength(0);
  });
});
