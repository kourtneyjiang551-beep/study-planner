import Dexie, { type EntityTable } from 'dexie';
import type {
  Profile,
  Child,
  Subject,
  Task,
  TaskRecord,
  Grade,
  MedalDefinition,
  MedalUnlock,
  Reward,
  RewardRedemption,
  PointsLog,
  SyncQueueItem,
} from '@/types';

class StudyPlannerDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  children!: EntityTable<Child, 'id'>;
  subjects!: EntityTable<Subject, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  taskRecords!: EntityTable<TaskRecord, 'id'>;
  grades!: EntityTable<Grade, 'id'>;
  medalDefinitions!: EntityTable<MedalDefinition, 'id'>;
  medalUnlocks!: EntityTable<MedalUnlock, 'id'>;
  rewards!: EntityTable<Reward, 'id'>;
  rewardRedemptions!: EntityTable<RewardRedemption, 'id'>;
  pointsLog!: EntityTable<PointsLog, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('StudyPlannerDB');

    this.version(1).stores({
      profiles: 'id, user_id',
      children: 'id, profile_id',
      subjects: 'id, child_id, [child_id+sort_order]',
      tasks: 'id, child_id, subject_id, [child_id+is_active], template_id',
      taskRecords: 'id, task_id, child_id, date, [task_id+date], [child_id+date], [child_id+status]',
      grades: 'id, child_id, subject_id, exam_date, [child_id+subject_id]',
      medalDefinitions: 'id, child_id',
      medalUnlocks: 'id, medal_definition_id, child_id, [medal_definition_id+child_id]',
      rewards: 'id, child_id',
      rewardRedemptions: 'id, reward_id, child_id',
      pointsLog: 'id, child_id, created_at, [child_id+created_at]',
      syncQueue: 'id, table, record_id, created_at',
    });

    this.version(2).stores({
      children: 'id, profile_id, user_id',
    }).upgrade(tx => {
      return tx.table('children').toCollection().modify(() => {
        // no-op: user_id remains undefined for local-only data
      });
    });
  }
}

export const db = new StudyPlannerDB();
