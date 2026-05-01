import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
});

test('add task and see it in task list', async ({ page }) => {
  // 点击"添加"按钮（文字包含"添加"）
  await page.locator('button:has-text("添加")').first().click();
  await page.locator('input[placeholder="例如: 晨读"]').waitFor({ state: 'visible', timeout: 5000 });

  // 任务名称输入框（通过 placeholder 定位）
  await page.locator('input[placeholder="例如: 晨读"]').fill('测试任务');

  // 计划时长输入框（type=number，第一个数字输入框）
  const durationInput = page.locator('form input[type="number"]').first();
  await durationInput.clear();
  await durationInput.fill('15');

  // 提交按钮
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('text=测试任务')).toBeVisible({ timeout: 10000 });
});
