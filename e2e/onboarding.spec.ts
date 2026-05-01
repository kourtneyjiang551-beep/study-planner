/* eslint-disable @typescript-eslint/no-explicit-any -- E2E test: window.__testDB is untyped dev bridge */
import { test, expect, Page } from '@playwright/test';

/** 清空所有数据库表，模拟全新用户 */
async function clearDatabase(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => (window as any).__testDB !== undefined, { timeout: 10000 });
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    await Promise.all([
      db.profiles.clear(), db.children.clear(), db.subjects.clear(),
      db.tasks.clear(), db.taskRecords.clear(), db.grades.clear(),
      db.medalDefinitions.clear(), db.medalUnlocks.clear(), db.rewards.clear(),
      db.rewardRedemptions.clear(), db.pointsLog.clear(),
    ]);
  });
}

test.describe('Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    // 刷新触发引导向导
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('shows welcome screen for new user', async ({ page }) => {
    await expect(page.locator('text=欢迎使用好学伴')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=开始设置')).toBeVisible();
  });

  test('completes full onboarding flow', async ({ page }) => {
    // Step 1: 欢迎页
    await expect(page.locator('text=欢迎使用好学伴')).toBeVisible({ timeout: 10000 });
    await page.locator('text=开始设置').click();

    // Step 2: 孩子信息
    await expect(page.locator('text=孩子信息')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="请输入孩子姓名"]').fill('小明');
    await page.locator('button:has-text("🧒")').click();
    await page.locator('button:has-text("五年级")').click();
    await page.locator('button:has-text("下一步")').click();

    // Step 3: 选主题
    await expect(page.locator('text=选择主题')).toBeVisible({ timeout: 5000 });
    await page.locator('text=魔法学园').click();
    await page.locator('button:has-text("下一步")').click();

    // Step 4: 选科目（默认已选语数英）
    await expect(page.locator('text=选择科目')).toBeVisible({ timeout: 5000 });
    // 加选跑步
    await page.locator('button:has-text("跑步")').click();
    await page.locator('button:has-text("下一步")').click();

    // Step 5: PIN — 跳过
    await expect(page.locator('text=设置家长 PIN')).toBeVisible({ timeout: 5000 });
    await page.locator('text=以后再设').click();

    // Step 6: 完成
    await expect(page.locator('text=设置完成')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=小明')).toBeVisible();
    await page.locator('text=进入学习').click();

    // 进入 dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('requires child name before proceeding', async ({ page }) => {
    await expect(page.locator('text=欢迎使用好学伴')).toBeVisible({ timeout: 10000 });
    await page.locator('text=开始设置').click();

    await expect(page.locator('text=孩子信息')).toBeVisible({ timeout: 5000 });

    // 下一步按钮应该是 disabled（没输入姓名）
    const nextBtn = page.locator('button:has-text("下一步")');
    await expect(nextBtn).toBeDisabled();

    // 输入姓名后可以点击
    await page.locator('input[placeholder="请输入孩子姓名"]').fill('小红');
    await expect(nextBtn).toBeEnabled();
  });

  test('requires at least one subject', async ({ page }) => {
    await expect(page.locator('text=欢迎使用好学伴')).toBeVisible({ timeout: 10000 });
    await page.locator('text=开始设置').click();

    // 填孩子信息
    await page.locator('input[placeholder="请输入孩子姓名"]').fill('小明');
    await page.locator('button:has-text("下一步")').click();

    // 选主题
    await expect(page.locator('text=选择主题')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("下一步")').click();

    // 科目页面 — 取消所有默认选中
    await expect(page.locator('text=选择科目')).toBeVisible({ timeout: 5000 });
    // 默认选中语文、数学、英语（index 0,1,2）—— 点击取消
    await page.locator('button:has-text("语文")').click();
    await page.locator('button:has-text("数学")').click();
    await page.locator('button:has-text("英语")').click();

    // 下一步应该 disabled
    const nextBtn = page.locator('button:has-text("下一步")');
    await expect(nextBtn).toBeDisabled();

    // 选一个后恢复
    await page.locator('button:has-text("语文")').click();
    await expect(nextBtn).toBeEnabled();
  });
});
