// Supabase CRUD 操作层 — 云端数据读写

import { createClient } from '@/lib/supabase/client';
import type {
  Profile, Child, Subject, Task, TaskRecord,
  Grade, MedalDefinition, MedalUnlock,
  Reward, RewardRedemption, PointsLog,
} from '@/types';

// 获取 Supabase 客户端
function supabase() { return createClient(); }

// 统一错误处理
function handleError(action: string, error: { message: string }): never {
  console.error(`[Supabase] ${action}失败:`, error.message);
  throw new Error(`${action}失败: ${error.message}`);
}

// ===== Profile =====

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') handleError('获取用户档案', error);
  return data ?? null;
}

export async function updateProfileCloud(id: string, data: Partial<Profile>) {
  const { error } = await supabase()
    .from('profiles')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新用户档案', error);
}

// ===== Children =====

export async function fetchChildren(userId: string): Promise<Child[]> {
  const { data, error } = await supabase()
    .from('children')
    .select('*')
    .eq('user_id', userId);
  if (error) handleError('获取孩子列表', error);
  return data ?? [];
}

export async function insertChild(child: Child) {
  const { error } = await supabase().from('children').insert(child);
  if (error) handleError('创建孩子', error);
}

export async function updateChildCloud(id: string, data: Partial<Child>) {
  const { error } = await supabase()
    .from('children')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新孩子信息', error);
}

export async function deleteChildCloud(childId: string) {
  const { error } = await supabase()
    .from('children')
    .delete()
    .eq('id', childId);
  if (error) handleError('删除孩子', error);
}

// ===== Subjects =====

export async function checkSubjectExists(id: string): Promise<boolean> {
  const { count, error } = await supabase()
    .from('subjects')
    .select('id', { count: 'exact', head: true })
    .eq('id', id);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function checkMedalDefinitionExists(id: string): Promise<boolean> {
  const { count, error } = await supabase()
    .from('medal_definitions')
    .select('id', { count: 'exact', head: true })
    .eq('id', id);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function fetchSubjects(childId: string): Promise<Subject[]> {
  const { data, error } = await supabase()
    .from('subjects')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取科目列表', error);
  return data ?? [];
}

export async function insertSubject(subject: Subject) {
  const { error } = await supabase().from('subjects').insert(subject);
  if (error) handleError('创建科目', error);
}

export async function updateSubjectCloud(id: string, data: Partial<Subject>) {
  const { error } = await supabase()
    .from('subjects')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新科目', error);
}

export async function deleteSubjectCloud(id: string) {
  const { error } = await supabase()
    .from('subjects')
    .delete()
    .eq('id', id);
  if (error) handleError('删除科目', error);
}

// ===== Tasks =====

export async function fetchTasks(childId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取任务列表', error);
  return data ?? [];
}

export async function insertTask(task: Task) {
  const { error } = await supabase().from('tasks').insert(task);
  if (error) handleError('创建任务', error);
}

export async function updateTaskCloud(id: string, data: Partial<Task>) {
  const { error } = await supabase()
    .from('tasks')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新任务', error);
}

// ===== TaskRecords =====

export async function fetchTaskRecords(childId: string, date: string): Promise<TaskRecord[]> {
  const { data, error } = await supabase()
    .from('task_records')
    .select('*')
    .eq('child_id', childId)
    .eq('date', date);
  if (error) handleError('获取任务记录', error);
  return data ?? [];
}

export async function upsertTaskRecord(record: TaskRecord) {
  const { error } = await supabase()
    .from('task_records')
    .upsert(record, { onConflict: 'task_id,date' });
  if (error) handleError('更新任务记录', error);
}

// ===== Grades =====

export async function fetchGrades(childId: string): Promise<Grade[]> {
  const { data, error } = await supabase()
    .from('grades')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取成绩列表', error);
  return data ?? [];
}

export async function insertGrade(grade: Grade) {
  const { error } = await supabase().from('grades').insert(grade);
  if (error) handleError('创建成绩', error);
}

export async function updateGradeCloud(id: string, data: Partial<Grade>) {
  const { error } = await supabase()
    .from('grades')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新成绩', error);
}

export async function deleteGradeCloud(id: string) {
  const { error } = await supabase()
    .from('grades')
    .delete()
    .eq('id', id);
  if (error) handleError('删除成绩', error);
}

// ===== MedalDefinitions =====

export async function fetchMedalDefinitions(childId: string): Promise<MedalDefinition[]> {
  const { data, error } = await supabase()
    .from('medal_definitions')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取勋章定义', error);
  return data ?? [];
}

export async function insertMedalDefinition(medal: MedalDefinition) {
  const { error } = await supabase().from('medal_definitions').insert(medal);
  if (error) handleError('创建勋章定义', error);
}

// ===== MedalUnlocks =====

export async function fetchMedalUnlocks(childId: string): Promise<MedalUnlock[]> {
  const { data, error } = await supabase()
    .from('medal_unlocks')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取勋章解锁记录', error);
  return data ?? [];
}

export async function insertMedalUnlock(unlock: MedalUnlock) {
  const { error } = await supabase().from('medal_unlocks').insert(unlock);
  if (error) handleError('创建勋章解锁记录', error);
}

// ===== Rewards =====

export async function fetchRewards(childId: string): Promise<Reward[]> {
  const { data, error } = await supabase()
    .from('rewards')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取奖励列表', error);
  return data ?? [];
}

export async function insertReward(reward: Reward) {
  const { error } = await supabase().from('rewards').insert(reward);
  if (error) handleError('创建奖励', error);
}

export async function updateRewardCloud(id: string, data: Partial<Reward>) {
  const { error } = await supabase()
    .from('rewards')
    .update(data)
    .eq('id', id);
  if (error) handleError('更新奖励', error);
}

// ===== RewardRedemptions =====

export async function fetchRewardRedemptions(childId: string): Promise<RewardRedemption[]> {
  const { data, error } = await supabase()
    .from('reward_redemptions')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取兑换记录', error);
  return data ?? [];
}

export async function insertRewardRedemption(redemption: RewardRedemption) {
  const { error } = await supabase().from('reward_redemptions').insert(redemption);
  if (error) handleError('创建兑换记录', error);
}

// ===== PointsLog =====

export async function fetchPointsLog(childId: string): Promise<PointsLog[]> {
  const { data, error } = await supabase()
    .from('points_log')
    .select('*')
    .eq('child_id', childId);
  if (error) handleError('获取积分记录', error);
  return data ?? [];
}

export async function insertPointsLog(log: PointsLog) {
  const { error } = await supabase().from('points_log').insert(log);
  if (error) handleError('创建积分记录', error);
}

// ===== 批量初始化（用于登录后全量同步） =====

export async function fetchAllDataForUser(userId: string) {
  const profile = await fetchProfile(userId);
  const children = await fetchChildren(userId);

  const childDataList = await Promise.all(
    children.map(async (child) => {
      const [
        subjects,
        tasks,
        grades,
        medalDefinitions,
        medalUnlocks,
        rewards,
        rewardRedemptions,
        pointsLog,
      ] = await Promise.all([
        fetchSubjects(child.id),
        fetchTasks(child.id),
        fetchGrades(child.id),
        fetchMedalDefinitions(child.id),
        fetchMedalUnlocks(child.id),
        fetchRewards(child.id),
        fetchRewardRedemptions(child.id),
        fetchPointsLog(child.id),
      ]);
      return {
        child,
        subjects,
        tasks,
        grades,
        medalDefinitions,
        medalUnlocks,
        rewards,
        rewardRedemptions,
        pointsLog,
      };
    })
  );

  return { profile, children, childDataList };
}
