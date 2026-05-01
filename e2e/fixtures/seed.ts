/* eslint-disable @typescript-eslint/no-explicit-any -- E2E test fixture: window.__testDB is untyped dev bridge */
import { Page } from '@playwright/test';

async function waitForDB(page: Page) {
  await page.waitForFunction(() => (window as any).__testDB !== undefined, { timeout: 10000 });
}

export async function injectTaskFixture(page: Page) {
  await waitForDB(page);
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    const ts = new Date().toISOString();

    await db.profiles.put({
      id: 'default-profile', display_name: '测试用户', avatar: '',
      current_theme: 'dojo', last_active_child_id: 'default-child',
      created_at: ts, updated_at: ts,
    });
    await db.children.put({
      id: 'default-child', profile_id: 'default-profile',
      name: '宝贝', avatar: '', grade: '三年级',
      current_points: 50, streak_days: 0,
      created_at: ts, updated_at: ts,
    });
    await db.subjects.put({
      id: 'sub-1', child_id: 'default-child',
      name: '语文', color: '#EF4444', icon: '📖', category: 'academic',
      sort_order: 0, created_at: ts, updated_at: ts,
    });
  });
}

export async function clearAll(page: Page) {
  await waitForDB(page);
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    const tables = [
      db.subjects, db.tasks, db.taskRecords, db.grades,
      db.medalDefinitions, db.medalUnlocks, db.rewards,
      db.rewardRedemptions, db.pointsLog,
    ];
    await Promise.all(tables.map((t: { clear: () => Promise<void> }) => t.clear()));
  });
}
