import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { awardPoints, descriptionForSource } from '@/lib/utils/points';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import { createClient } from '@/lib/supabase/client';
import type { Reward } from '@/types';

export function useRewards(childId: string) {
  return useLiveQuery(() => db.rewards.where({ child_id: childId }).filter(r => r.is_active).toArray(), [childId]);
}

export function usePointsLog(childId: string) {
  return useLiveQuery(
    () => db.pointsLog.where({ child_id: childId }).toArray()
      .then(r => r.sort((a, b) => b.created_at.localeCompare(a.created_at))),
    [childId],
  );
}

export async function createReward(childId: string, data: {
  name: string; description: string; icon: string; points_cost: number; quantity: number | null;
}): Promise<string> {
  try {
    const id = generateId();
    const reward: Reward = {
      id, child_id: childId, ...data, is_active: true, created_at: now(), updated_at: now(),
    };
    if (getDataMode() === 'cloud') {
      await cloud.insertReward(reward);
    }
    await db.rewards.add(reward);
    return id;
  } catch (e) { handleDBError('创建奖励', e); }
}

export async function deleteReward(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateRewardCloud(id, { is_active: false });
    }
    await db.rewards.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除奖励', e); }
}

export async function updateReward(id: string, data: Partial<{ name: string; description: string; icon: string; points_cost: number; quantity: number | null }>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateRewardCloud(id, data);
    }
    await db.rewards.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新奖励', e); }
}

export async function redeemReward(childId: string, rewardId: string): Promise<boolean> {
  try {
    const reward = await db.rewards.get(rewardId);
    const child = await db.children.get(childId);
    if (!reward || !child) return false;
    if (child.current_points < reward.points_cost) return false;
    if (reward.quantity !== null && reward.quantity <= 0) return false;

    if (getDataMode() === 'cloud') {
      await createClient().rpc('redeem_reward', { p_child_id: childId, p_reward_id: rewardId });
    }

    await db.transaction('rw', [db.children, db.pointsLog, db.rewardRedemptions, db.rewards], async () => {
      const txChild = await db.children.get(childId);
      if (!txChild || txChild.current_points < reward.points_cost) throw new Error('积分不足');
      await db.children.update(childId, {
        current_points: txChild.current_points - reward.points_cost, updated_at: now(),
      });
      await db.pointsLog.add({
        id: generateId(), child_id: childId, amount: -reward.points_cost,
        type: 'spend', source: 'reward_redeem', source_id: rewardId,
        description: descriptionForSource('reward_redeem', -reward.points_cost),
        created_at: now(),
      });
      await db.rewardRedemptions.add({
        id: generateId(), reward_id: rewardId, child_id: childId,
        points_spent: reward.points_cost, redeemed_at: now(),
      });
      if (reward.quantity !== null) {
        await db.rewards.update(rewardId, { quantity: reward.quantity - 1, updated_at: now() });
      }
    });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === '积分不足') return false;
    handleDBError('兑换奖励', e);
  }
}
