import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { awardPoints } from '@/lib/utils/points';
import { now } from '@/lib/utils/id';

const TEST_CHILD_ID = 'test-child-001';

async function seedChild(points = 100) {
  await db.children.add({
    id: TEST_CHILD_ID,
    profile_id: 'profile-001',
    name: '测试小朋友',
    avatar: '🧒',
    grade: '三年级',
    current_points: points,
    streak_days: 0,
    created_at: now(),
    updated_at: now(),
  });
}

describe('awardPoints', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedChild(100);
  });

  it('正数积分增加余额', async () => {
    await awardPoints(TEST_CHILD_ID, 50, 'task_complete', 'task-001');

    const child = await db.children.get(TEST_CHILD_ID);
    expect(child!.current_points).toBe(150);
  });

  it('负数积分减少余额', async () => {
    await awardPoints(TEST_CHILD_ID, -30, 'reward_redeem', 'reward-001');

    const child = await db.children.get(TEST_CHILD_ID);
    expect(child!.current_points).toBe(70);
  });

  it('创建 earn 类型的积分流水', async () => {
    await awardPoints(TEST_CHILD_ID, 20, 'task_complete', 'task-002');

    const logs = await db.pointsLog.where('child_id').equals(TEST_CHILD_ID).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('earn');
    expect(logs[0].amount).toBe(20);
    expect(logs[0].source).toBe('task_complete');
    expect(logs[0].source_id).toBe('task-002');
    expect(logs[0].child_id).toBe(TEST_CHILD_ID);
  });

  it('创建 spend 类型的积分流水', async () => {
    await awardPoints(TEST_CHILD_ID, -10, 'reward_redeem', 'reward-002');

    const logs = await db.pointsLog.where('child_id').equals(TEST_CHILD_ID).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('spend');
    expect(logs[0].amount).toBe(-10);
    expect(logs[0].source).toBe('reward_redeem');
  });

  it('孩子不存在时抛出错误', async () => {
    await expect(
      awardPoints('non-existent-id', 10, 'task_complete'),
    ).rejects.toThrow('Child not found');
  });
});
