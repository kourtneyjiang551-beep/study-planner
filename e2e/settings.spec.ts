import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('theme switch persists after reload', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');

  // 点击"魔法学园"主题卡片
  await page.locator('button:has-text("魔法学园")').click();

  // 验证"当前使用"文字可见
  await expect(page.locator('text=当前使用')).toBeVisible({ timeout: 10000 });

  // 刷新页面
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // 验证"当前使用"仍然可见（主题持久化）
  await expect(page.locator('text=当前使用')).toBeVisible({ timeout: 10000 });
});

test('data export downloads a file', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');

  // 等待下载事件 + 点击导出
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button:has-text("导出备份")').click(),
  ]);

  // 验证下载文件名包含 study-planner-backup
  expect(download.suggestedFilename()).toContain('study-planner-backup');
});
