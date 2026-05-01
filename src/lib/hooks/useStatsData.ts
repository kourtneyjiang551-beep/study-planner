import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import type { Subject, Task, TaskRecord } from '@/types';

export interface StatsDateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

/** 每日完成情况（图表 1） */
export interface DailyCompletion {
  date: string;
  planned: number;
  completed: number;
}

/** 分类时间（图表 2） */
export interface CategoryTime {
  date: string;
  academic: number; // 秒
  sport: number;
  entertainment: number;
}

/** 科目占比（图表 3） */
export interface SubjectShare {
  name: string;
  color: string;
  seconds: number;
}

/** 科目每日堆叠（图表 4） */
export interface DailySubjectStack {
  date: string;
  [subjectName: string]: number | string; // 科目名: 秒数
}

/** 计划 vs 实际（图表 5） */
export interface PlannedVsActual {
  subjectName: string;
  color: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface StatsData {
  dailyCompletion: DailyCompletion[];
  categoryTime: CategoryTime[];
  subjectShare: SubjectShare[];
  dailySubjectStack: { dates: string[]; subjects: { name: string; color: string; data: number[] }[] };
  plannedVsActual: PlannedVsActual[];
  subjectList: Subject[];
}

const EMPTY: StatsData = {
  dailyCompletion: [],
  categoryTime: [],
  subjectShare: [],
  dailySubjectStack: { dates: [], subjects: [] },
  plannedVsActual: [],
  subjectList: [],
};

/** 生成日期范围内的所有日期 */
function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (d <= endDate) {
    // 使用本地时间格式化，与 formatDate / today() 保持一致
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function useStatsData(childId: string, range: StatsDateRange): StatsData {
  const data = useLiveQuery(async () => {
    // 并行查询
    const [allRecords, subjects, tasks] = await Promise.all([
      db.taskRecords
        .where({ child_id: childId })
        .filter(r => r.date >= range.start && r.date <= range.end)
        .toArray(),
      db.subjects.where({ child_id: childId }).toArray(),
      db.tasks.where({ child_id: childId }).filter(t => t.is_active).toArray(),
    ]);

    console.log('[Stats] childId:', childId, 'range:', range.start, '-', range.end, 'records:', allRecords.length, 'tasks:', tasks.length, 'subjects:', subjects.length, 'record dates:', allRecords.map(r => r.date), 'record statuses:', allRecords.map(r => r.status));

    if (!allRecords.length) {
      console.log('[Stats] 无记录，返回空数据');
      return { ...EMPTY, subjectList: subjects };
    }

    // 查找表
    const subjectMap = new Map<string, Subject>();
    for (const s of subjects) subjectMap.set(s.id, s);

    const taskMap = new Map<string, Task>();
    for (const t of tasks) taskMap.set(t.id, t);

    const dates = getDatesInRange(range.start, range.end);

    // 按日期分组
    const recordsByDate = new Map<string, TaskRecord[]>();
    for (const r of allRecords) {
      const arr = recordsByDate.get(r.date) ?? [];
      arr.push(r);
      recordsByDate.set(r.date, arr);
    }

    // 图表 1: 每日计划完成情况
    const dailyCompletion: DailyCompletion[] = dates.map(date => {
      const dayRecords = recordsByDate.get(date) ?? [];
      return {
        date,
        planned: dayRecords.length,
        completed: dayRecords.filter(r => r.status === 'completed').length,
      };
    });

    // 图表 2: 分类时间
    const categoryTime: CategoryTime[] = dates.map(date => {
      const dayRecords = recordsByDate.get(date) ?? [];
      let academic = 0, sport = 0, entertainment = 0;
      for (const r of dayRecords) {
        const task = taskMap.get(r.task_id);
        const subjectId = task?.subject_id;
        const category = subjectId ? subjectMap.get(subjectId)?.category ?? 'academic' : 'academic';
        const secs = r.actual_duration_seconds;
        if (category === 'sport') sport += secs;
        else if (category === 'entertainment') entertainment += secs;
        else academic += secs;
      }
      return { date, academic, sport, entertainment };
    });

    // 图表 3: 各科目总用时占比
    const subjectSeconds = new Map<string, number>();
    for (const r of allRecords) {
      const task = taskMap.get(r.task_id);
      const subjectId = task?.subject_id ?? '__none__';
      subjectSeconds.set(subjectId, (subjectSeconds.get(subjectId) ?? 0) + r.actual_duration_seconds);
    }
    const subjectShare: SubjectShare[] = [];
    for (const [sid, secs] of subjectSeconds) {
      if (secs === 0) continue;
      const subject = subjectMap.get(sid);
      subjectShare.push({
        name: subject?.name ?? '未分类',
        color: subject?.color ?? '#888888',
        seconds: secs,
      });
    }
    subjectShare.sort((a, b) => b.seconds - a.seconds);

    // 图表 4: 科目每日堆叠
    const subjectNames = subjectShare.map(s => s.name);
    const subjectColors = subjectShare.map(s => s.color);
    // 构建 subject name → id 反查
    const nameToSubjectId = new Map<string, string>();
    for (const [sid] of subjectSeconds) {
      const subject = subjectMap.get(sid);
      nameToSubjectId.set(subject?.name ?? '未分类', sid);
    }

    const dailySubjectStack = {
      dates,
      subjects: subjectNames.map((name, i) => {
        const sid = nameToSubjectId.get(name);
        return {
          name,
          color: subjectColors[i],
          data: dates.map(date => {
            const dayRecords = recordsByDate.get(date) ?? [];
            let total = 0;
            for (const r of dayRecords) {
              const task = taskMap.get(r.task_id);
              const taskSid = task?.subject_id ?? '__none__';
              if (taskSid === sid || (!sid && taskSid === '__none__')) {
                total += r.actual_duration_seconds;
              }
            }
            return Math.round(total / 60); // 转换为分钟
          }),
        };
      }),
    };

    // 图表 5: 计划用时 vs 实际用时（按科目）
    const plannedBySubject = new Map<string, number>();
    const actualBySubject = new Map<string, number>();
    for (const r of allRecords) {
      const task = taskMap.get(r.task_id);
      const subjectId = task?.subject_id ?? '__none__';
      plannedBySubject.set(subjectId, (plannedBySubject.get(subjectId) ?? 0) + (task?.planned_duration_minutes ?? 0));
      actualBySubject.set(subjectId, (actualBySubject.get(subjectId) ?? 0) + r.actual_duration_seconds);
    }
    const plannedVsActual: PlannedVsActual[] = [];
    for (const [sid, planned] of plannedBySubject) {
      const subject = subjectMap.get(sid);
      const actual = actualBySubject.get(sid) ?? 0;
      plannedVsActual.push({
        subjectName: subject?.name ?? '未分类',
        color: subject?.color ?? '#888888',
        plannedMinutes: planned,
        actualMinutes: Math.round(actual / 60),
      });
    }
    plannedVsActual.sort((a, b) => b.plannedMinutes - a.plannedMinutes);

    return {
      dailyCompletion,
      categoryTime,
      subjectShare,
      dailySubjectStack,
      plannedVsActual,
      subjectList: subjects,
    };
  }, [childId, range.start, range.end]);

  console.log('[Stats] useLiveQuery 返回:', data ? `dailyCompletion有${data.dailyCompletion.length}条` : 'undefined');
  return data ?? EMPTY;
}
