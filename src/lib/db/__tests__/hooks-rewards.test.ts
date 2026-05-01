import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { createReward, redeemReward } from '../hooks';
import { now } from '@/lib/utils/id';

const TEST_CHILD_ID = 'test-child-rewards';

async function seedChild(points = 100) {
  await db.children.add({
    id: TEST_CHILD_ID,
    profile_id: 'profile-001',
    name: '测试小朋友',
    avatar: '',
    grade: '五年级',
    current_points: points,
    streak_days: 0,
    created_at: now(),
    updated_at: now(),
  });
}

const rewardData = {
  name: '冰淇淋',
  description: '一个冰淇淋奖励',
  icon: '🍦',
  points_cost: 30,
  quantity: 3 as number | null,
};

describe('Rewards', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedChild(100);
  });

  it('redeemReward 扣分并创建兑换记录', async () => {
    const rewardId = await createReward(TEST_CHILD_ID, rewardData);

    const result = await redeemReward(TEST_CHILD_ID, rewardId);

    expect(result).toBe(true);
    // 积分扣减
    const child = await db.children.get(TEST_CHILD_ID);
    expect(child!.current_points).toBe(70);
    // 兑换记录
    const redemptions = await db.rewardRedemptions.where({ child_id: TEST_CHILD_ID }).toArray();
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0].reward_id).toBe(rewardId);
    expect(redemptions[0].points_spent).toBe(30);
  });

  it('redeemReward 余额不足时返回 false 且不扣分', async () => {
    const expensiveReward = { ...rewardData, points_cost: 200 };
    const rewardId = await createReward(TEST_CHILD_ID, expensiveReward);

    const result = await redeemReward(TEST_CHILD_ID, rewardId);

    expect(result).toBe(false);
    // 积分不变
    const child = await db.children.get(TEST_CHILD_ID);
    expect(child!.current_points).toBe(100);
    // 无兑换记录
    const redemptions = await db.rewardRedemptions.where({ child_id: TEST_CHILD_ID }).toArray();
    expect(redemptions).toHaveLength(0);
  });

  it('redeemReward 兑换后库存减少', async () => {
    const rewardId = await createReward(TEST_CHILD_ID, rewardData);

    await redeemReward(TEST_CHILD_ID, rewardId);

    const reward = await db.rewards.get(rewardId);
    expect(reward!.quantity).toBe(2);
  });

  it('redeemReward 库存为 0 时返回 false（售罄）', async () => {
    const soldOutReward = { ...rewardData, quantity: 0 as number | null };
    const rewardId = await createReward(TEST_CHILD_ID, soldOutReward);

    const result = await redeemReward(TEST_CHILD_ID, rewardId);

    expect(result).toBe(false);
    // 积分不变
    const child = await db.children.get(TEST_CHILD_ID);
    expect(child!.current_points).toBe(100);
  });
});
