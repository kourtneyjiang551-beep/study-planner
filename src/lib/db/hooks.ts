/**
 * 数据库 CRUD hooks — 统一导出入口
 * 实际实现已拆分到各领域模块：
 *   children.ts   — 孩子管理
 *   subjects.ts  — 科目管理
 *   tasks.ts     — 任务 + 模板
 *   records.ts  — 任务记录（每日生成、逾期查询）
 *   grades.ts   — 成绩管理
 *   medals.ts    — 勋章系统
 *   rewards.ts  — 奖励系统
 *   migration.ts — 本地→云端数据迁移
 *   sync.ts     — 云端→本地同步 + SyncQueue 处理
 */

export { useChildren, createChild, updateChild, deleteChild } from './children';
export { useSubjects, createSubject, updateSubject, deleteSubject } from './subjects';
export { useTasks, useActiveTasks, useTemplates, createTask, updateTask, deleteTask, createTemplate, createTemplateFromPreset, deleteTemplate } from './tasks';
export { useTaskRecords, ensureTaskRecordsForDate, useOverdueRecords } from './records';
export { useGrades, createGrade, updateGrade, deleteGrade, type GradeFilters } from './grades';
export { useMedalDefinitions, useMedalUnlocks, createMedalDefinition, deleteMedalDefinition, unlockMedal } from './medals';
export { useRewards, usePointsLog, createReward, deleteReward, updateReward, redeemReward } from './rewards';
export { migrateLocalToCloud, hasLocalData, hasCloudData } from './migration';
export { pullCloudToLocal, processSyncQueue, clearLocalData } from './sync';
