// src/lib/db/seed-demo.ts
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { formatDate } from '@/lib/utils/date';
import { PRESET_SUBJECTS, seedPresetsForChild } from './seed';

/** 一键加载演示数据（清空后重建） */
export async function loadDemoData(childId: string) {
  // 只清除当前孩子的数据，不影响其他孩子
  await Promise.all([
    db.subjects.where({ child_id: childId }).delete(),
    db.tasks.where({ child_id: childId }).delete(),
    db.taskRecords.where({ child_id: childId }).delete(),
    db.grades.where({ child_id: childId }).delete(),
    db.medalDefinitions.where({ child_id: childId }).delete(),
    db.medalUnlocks.where({ child_id: childId }).delete(),
    db.rewards.where({ child_id: childId }).delete(),
    db.rewardRedemptions.where({ child_id: childId }).delete(),
    db.pointsLog.where({ child_id: childId }).delete(),
  ]);

  // 重置积分
  await db.children.update(childId, {
    current_points: 320,
    streak_days: 7,
    updated_at: now(),
  });

  const ts = now();

  // 科目
  const subjectIds: string[] = [];
  for (let i = 0; i < PRESET_SUBJECTS.length; i++) {
    const s = PRESET_SUBJECTS[i];
    const id = generateId();
    subjectIds.push(id);
    await db.subjects.put({
      id, child_id: childId,
      name: s.name, color: s.color, icon: s.icon, category: s.category,
      sort_order: i, created_at: ts, updated_at: ts,
    });
  }

  // 任务（12 个）
  const taskDefs = [
    { name: '晨读', subIdx: 0, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 20 },
    { name: '数学练习', subIdx: 1, repeat: 'weekdays', days: [1,2,3,4,5], mins: 40 },
    { name: '英语听力', subIdx: 2, repeat: 'weekdays', days: [1,2,3,4,5], mins: 30 },
    { name: '物理实验', subIdx: 3, repeat: 'custom', days: [2,4], mins: 45 },
    { name: '化学笔记', subIdx: 4, repeat: 'custom', days: [1,3,5], mins: 30 },
    { name: '晨跑', subIdx: 8, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 30 },
    { name: '游泳训练', subIdx: 10, repeat: 'custom', days: [3,6], mins: 60 },
    { name: '课外阅读', subIdx: 11, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 30 },
    { name: '画画', subIdx: 12, repeat: 'custom', days: [6,7], mins: 45 },
    { name: '钢琴练习', subIdx: 13, repeat: 'weekdays', days: [1,2,3,4,5], mins: 30 },
    { name: '单元复习', subIdx: 0, repeat: 'once', days: [], mins: 60 },
    { name: '作文练习', subIdx: 0, repeat: 'custom', days: [3,5], mins: 40 },
  ];

  const taskIds: string[] = [];
  for (let i = 0; i < taskDefs.length; i++) {
    const t = taskDefs[i];
    const id = generateId();
    taskIds.push(id);
    await db.tasks.put({
      id, child_id: childId,
      subject_id: subjectIds[t.subIdx],
      name: t.name, content: '',
      repeat_type: t.repeat as 'daily' | 'weekdays' | 'custom' | 'once',
      repeat_days: t.days,
      planned_duration_minutes: t.mins,
      points_reward: Math.round(t.mins / 3),
      is_template: false, sort_order: i, is_active: true,
      created_at: '2026-03-01T08:00:00.000Z', updated_at: ts,
    });
  }

  // 打卡记录（最近 30 天）
  const today = new Date();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = formatDate(date);
    const dow = date.getDay() === 0 ? 7 : date.getDay();

    for (let ti = 0; ti < taskDefs.length; ti++) {
      const t = taskDefs[ti];
      if (t.repeat === 'once' && d !== 15) continue;
      if (t.repeat === 'weekdays' && (dow === 6 || dow === 7)) continue;
      if (t.repeat === 'custom' && !t.days.includes(dow)) continue;

      const completed = Math.random() > 0.2; // 80% 完成率
      const duration = completed ? Math.floor(t.mins * 60 * (0.7 + Math.random() * 0.6)) : 0;

      await db.taskRecords.put({
        id: generateId(), task_id: taskIds[ti], child_id: childId,
        date: dateStr,
        status: completed ? 'completed' : (Math.random() > 0.5 ? 'pending' : 'skipped'),
        actual_duration_seconds: duration,
        is_manual_complete: !completed && Math.random() > 0.7,
        created_at: ts, updated_at: ts,
      });
    }
  }

  // 成绩
  const gradeEntries = [
    { subIdx: 0, name: '语文期中', date: '2026-03-15', score: 92, subs: [{ name: '阅读', score: 28, total: 30 }, { name: '作文', score: 35, total: 40 }] },
    { subIdx: 0, name: '语文月考', date: '2026-02-20', score: 88, subs: [] },
    { subIdx: 1, name: '数学期中', date: '2026-03-15', score: 95, subs: [{ name: '计算', score: 48, total: 50 }, { name: '应用题', score: 27, total: 30 }] },
    { subIdx: 1, name: '数学月考', date: '2026-02-20', score: 90, subs: [] },
    { subIdx: 2, name: '英语期中', date: '2026-03-15', score: 98, subs: [] },
    { subIdx: 2, name: '英语月考', date: '2026-02-20', score: 85, subs: [] },
  ];
  for (const g of gradeEntries) {
    await db.grades.put({
      id: generateId(), child_id: childId,
      subject_id: subjectIds[g.subIdx],
      exam_name: g.name, exam_type: '期中考试', exam_date: g.date,
      score: g.score, total_score: 100, target_score: 90,
      class_avg: g.score - 8, class_max: g.score + 3, class_rank: 5,
      semester: '下学期', grade_level: '三年级',
      sub_scores: g.subs.length > 0 ? g.subs : undefined,
      created_at: ts, updated_at: ts,
    });
  }

  // 勋章
  await seedPresetsForChild(childId);

  // 奖励
  const rewardDefs = [
    { name: '看一集动画片', icon: '📺', cost: 30, qty: null },
    { name: '买一本漫画', icon: '📚', cost: 100, qty: 3 },
    { name: '周末出去玩', icon: '🎢', cost: 200, qty: 1 },
  ];
  for (const r of rewardDefs) {
    await db.rewards.put({
      id: generateId(), child_id: childId,
      name: r.name, description: '', icon: r.icon,
      points_cost: r.cost, quantity: r.qty, is_active: true,
      created_at: ts, updated_at: ts,
    });
  }
}
