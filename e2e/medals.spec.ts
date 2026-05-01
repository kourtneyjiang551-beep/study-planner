import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('batch add preset medals', async ({ page }) => {
  await page.goto('/dashboard/medals');
  await page.waitForLoadState('networkidle');

  // 点击"批量添加"按钮
  await page.locator('button:has-text("批量添加")').click();
  await page.locator('input[type="checkbox"]').first().waitFor({ state: 'visible', timeout: 5000 });

  // 选择前 3 个预置勋章
  const checkboxes = page.locator('input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();

  // 点击"添加"按钮（按钮文字为 "添加 3 个勋章"）
  await page.locator('button:has-text("添加")').last().click();

  // 验证勋章名称出现（预置列表前3个：初次启航、学习新星、知识达人）
  await expect(page.locator('text=初次启航')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=学习新星')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=知识达人')).toBeVisible({ timeout: 10000 });
});
