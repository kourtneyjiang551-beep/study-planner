// 全局类型定义 — 与 IndexedDB 和 Supabase 表结构一致

export interface Profile {
  id: string;
  user_id?: string;
  display_name: string;
  avatar: string;
  current_theme: ThemeId;
  parent_pin_hash?: string;
  last_active_child_id?: string;
  invite_code?: string;
  membership_tier?: 'free' | 'basic' | 'premium';
  membership_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  profile_id: string;
  user_id?: string;
  name: string;
  avatar: string;
  grade: string;
  current_points: number;
  streak_days: number;
  created_at: string;
  updated_at: string;
}

export type SubjectCategory = 'academic' | 'sport' | 'entertainment';

export interface Subject {
  id: string;
  child_id: string;
  name: string;
  color: string;
  icon: string;
  category: SubjectCategory;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type RepeatType = 'daily' | 'weekdays' | 'custom' | 'once';

export interface Task {
  id: string;
  child_id: string;
  subject_id?: string;
  name: string;
  content: string;
  repeat_type: RepeatType;
  repeat_days: number[]; // [1-7], 1=周一, 7=周日
  planned_duration_minutes: number;
  planned_time_start?: string; // "07:00"
  planned_time_end?: string;   // "07:20"
  points_reward: number;
  is_template: boolean;
  is_preset?: boolean; // true = 预置模板，false/undefined = 用户自定义
  template_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface TaskRecord {
  id: string;
  task_id: string;
  child_id: string;
  date: string; // 'YYYY-MM-DD'
  status: TaskStatus;
  started_at?: string;
  paused_at?: string;
  completed_at?: string;
  actual_duration_seconds: number;
  is_manual_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubScore {
  name: string;
  score: number;
  total: number;
}

export interface Grade {
  id: string;
  child_id: string;
  subject_id?: string;
  exam_name: string;
  exam_type: string;
  exam_date: string;
  score: number;
  total_score: number;
  target_score?: number;
  class_avg?: number;
  class_max?: number;
  class_rank?: number;
  grade_rank?: number;
  semester: string;
  grade_level: string;
  sub_scores?: SubScore[];
  created_at: string;
  updated_at: string;
}

export type MedalConditionType =
  | 'study_hours'
  | 'streak_days'
  | 'task_count'
  | 'sport_hours'
  | 'first_checkin'
  | 'custom';

export interface MedalDefinition {
  id: string;
  child_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  condition_type: MedalConditionType;
  condition_value: number;
  is_preset: boolean;
  created_at: string;
}

export interface MedalUnlock {
  id: string;
  medal_definition_id: string;
  child_id: string;
  unlocked_at: string;
}

export interface Reward {
  id: string;
  child_id: string;
  name: string;
  description: string;
  icon: string;
  points_cost: number;
  quantity: number | null; // null = 无限
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  child_id: string;
  points_spent: number;
  redeemed_at: string;
}

export type PointsType = 'earn' | 'spend';
export type PointsSource = 'task_complete' | 'medal_unlock' | 'reward_redeem';

export interface PointsLog {
  id: string;
  child_id: string;
  amount: number;
  type: PointsType;
  source: PointsSource;
  source_id?: string;
  description: string;
  created_at: string;
}

// 同步队列
export interface SyncQueueItem {
  id: string;
  table: string;
  record_id: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
}

// 主题
export type ThemeId = 'dojo' | 'magic' | 'garden' | 'ocean';
