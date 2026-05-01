import type { ThemeId } from '@/types';

export const themeTerms: Record<ThemeId, Record<string, string>> = {
  dojo: {
    appName: '学问道场',
    points: '武德值', complete: '功成', level: '段位',
    study: '修行', subject: '武学', task: '功课',
    checkin: '修行', medal: '荣誉', reward: '奖赏',
    plan: '修行表', stats: '战绩', streak: '连续修行',
  },
  magic: {
    appName: '魔法学园',
    points: '魔法石', complete: '施法完成', level: '魔法等级',
    study: '修炼', subject: '魔法', task: '咒语',
    checkin: '施法', medal: '徽章', reward: '宝物',
    plan: '魔典', stats: '水晶球', streak: '连续修炼',
  },
  garden: {
    appName: '知识花园',
    points: '阳光值', complete: '开花', level: '园丁等级',
    study: '浇灌', subject: '花圃', task: '培育',
    checkin: '浇灌', medal: '花冠', reward: '果实',
    plan: '种植计划', stats: '花园日记', streak: '连续浇灌',
  },
  ocean: {
    appName: '智慧海洋',
    points: '珍珠', complete: '探索完成', level: '潜水等级',
    study: '潜水', subject: '海域', task: '探索',
    checkin: '��航', medal: '海星', reward: '宝藏',
    plan: '航海图', stats: '航海日志', streak: '连续出航',
  },
};
