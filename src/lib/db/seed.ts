import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import type { MedalConditionType } from '@/types';

const PRESET_MEDALS: {
  name: string;
  description: string;
  icon: string;
  condition_type: MedalConditionType;
  condition_value: number;
}[] = [
  { name: '时间小新芽', description: '学习时间累计超50小时', icon: '🌱', condition_type: 'study_hours', condition_value: 50 },
  { name: '知识探险家', description: '学习时间累计超80小时', icon: '🔭', condition_type: 'study_hours', condition_value: 80 },
  { name: '智慧萤火虫', description: '学习时间累计超100小时', icon: '🪲', condition_type: 'study_hours', condition_value: 100 },
  { name: '星空小学霸', description: '学习时间累计超150小时', icon: '⭐', condition_type: 'study_hours', condition_value: 150 },
  { name: '永恒时间大师', description: '学习时间累计超200小时', icon: '🏆', condition_type: 'study_hours', condition_value: 200 },
  { name: '活力小太阳', description: '运动时间达到5小时', icon: '☀️', condition_type: 'sport_hours', condition_value: 5 },
  { name: '疾风小猎豹', description: '运动时间达到20小时', icon: '🏃', condition_type: 'sport_hours', condition_value: 20 },
  { name: '每日签到星', description: '完成第一次打卡', icon: '✨', condition_type: 'first_checkin', condition_value: 1 },
  { name: '七日坚持者', description: '连续打卡7天', icon: '🔥', condition_type: 'streak_days', condition_value: 7 },
  { name: '月光守望者', description: '连续打卡50天', icon: '🌙', condition_type: 'streak_days', condition_value: 50 },
  { name: '百日筑梦师', description: '连续打卡100天', icon: '💯', condition_type: 'streak_days', condition_value: 100 },
  { name: '永恒自律者', description: '连续打卡180天', icon: '💎', condition_type: 'streak_days', condition_value: 180 },
  { name: '启航小能手', description: '累计完成任务50个', icon: '🚀', condition_type: 'task_count', condition_value: 50 },
];

/** 为新创建的孩子初始化预置勋章 */
export async function seedPresetsForChild(childId: string) {
  const existing = await db.medalDefinitions
    .where({ child_id: childId })
    .filter(m => m.is_preset)
    .count();

  if (existing > 0) return; // 已有预置勋章，跳过

  const timestamp = now();
  const medals = PRESET_MEDALS.map(m => ({
    id: generateId(),
    child_id: childId,
    name: m.name,
    description: m.description,
    icon: m.icon,
    color: '#FFD93D',
    condition_type: m.condition_type,
    condition_value: m.condition_value,
    is_preset: true,
    created_at: timestamp,
  }));

  await db.medalDefinitions.bulkPut(medals);
}

/** 为新创建的孩子初始化预置模板 */
export async function seedTemplatesForChild(childId: string) {
  const existing = await db.tasks
    .where({ child_id: childId })
    .filter(t => t.is_template === true && t.is_preset === true)
    .count();

  if (existing > 0) return; // 已有预置模板，跳过

  const timestamp = now();
  const templates = PRESET_TEMPLATES.map((p, i) => {
    const repeatDays = p.repeat_type === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
    return {
      id: generateId(),
      child_id: childId,
      name: p.name,
      content: p.content,
      repeat_type: p.repeat_type,
      repeat_days: repeatDays,
      planned_duration_minutes: p.planned_duration_minutes,
      points_reward: p.points_reward,
      is_template: true,
      is_preset: true,
      is_active: true,
      sort_order: i,
      created_at: timestamp,
      updated_at: timestamp,
    };
  });

  await db.tasks.bulkPut(templates);
}

/** 预置功课模板 */
export const PRESET_TEMPLATES: {
  name: string;
  content: string;
  repeat_type: 'daily' | 'weekdays';
  planned_duration_minutes: number;
  points_reward: number;
}[] = [
  { name: '晨读时光', content: '朗读课文或课外书', repeat_type: 'daily', planned_duration_minutes: 20, points_reward: 7 },
  { name: '数学练习', content: '完成口算或练习题', repeat_type: 'weekdays', planned_duration_minutes: 30, points_reward: 10 },
  { name: '英语朗读', content: '朗读英语课文或单词', repeat_type: 'daily', planned_duration_minutes: 15, points_reward: 5 },
  { name: '练字帖', content: '完成一页书法练习', repeat_type: 'weekdays', planned_duration_minutes: 15, points_reward: 5 },
  { name: '课外阅读', content: '自由阅读课外书籍', repeat_type: 'daily', planned_duration_minutes: 30, points_reward: 10 },
  { name: '跳绳运动', content: '完成跳绳锻炼', repeat_type: 'daily', planned_duration_minutes: 10, points_reward: 3 },
  { name: '作业时间', content: '完成当日课后作业', repeat_type: 'weekdays', planned_duration_minutes: 40, points_reward: 13 },
];

/** 为新创建的孩子初始化常用科目（语数英+运动） */
export async function seedSubjectsForChild(childId: string) {
  const existing = await db.subjects.where({ child_id: childId }).count();
  if (existing > 0) return;

  const timestamp = now();
  const defaults = PRESET_SUBJECTS.slice(0, 5); // 语数英物化
  const subjects = defaults.map((s, i) => ({
    id: generateId(),
    child_id: childId,
    name: s.name,
    icon: s.icon,
    color: s.color,
    category: s.category,
    sort_order: i,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  await db.subjects.bulkPut(subjects);
}

/** 预置科目模板 */
export const PRESET_SUBJECTS = [
  { name: '语文', icon: '📖', color: '#EF4444', category: 'academic' as const },
  { name: '数学', icon: '🔢', color: '#3B82F6', category: 'academic' as const },
  { name: '英语', icon: '🔤', color: '#8B5CF6', category: 'academic' as const },
  { name: '物理', icon: '⚡', color: '#F59E0B', category: 'academic' as const },
  { name: '化学', icon: '🧪', color: '#10B981', category: 'academic' as const },
  { name: '生物', icon: '🧬', color: '#EC4899', category: 'academic' as const },
  { name: '历史', icon: '📜', color: '#6366F1', category: 'academic' as const },
  { name: '地理', icon: '🌍', color: '#14B8A6', category: 'academic' as const },
  { name: '跑步', icon: '🏃', color: '#F97316', category: 'sport' as const },
  { name: '跳绳', icon: '🤸', color: '#06B6D4', category: 'sport' as const },
  { name: '游泳', icon: '🏊', color: '#0EA5E9', category: 'sport' as const },
  { name: '阅读', icon: '📚', color: '#A855F7', category: 'entertainment' as const },
  { name: '画画', icon: '🎨', color: '#D946EF', category: 'entertainment' as const },
  { name: '钢琴', icon: '🎹', color: '#78716C', category: 'entertainment' as const },
];
