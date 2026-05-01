import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('add a reward and redeem it', async ({ page }) => {
  await page.goto('/dashboard/rewards');
  await page.waitForLoadState('networkidle');

  // 确认初始积分为 50
  await expect(page.locator('text=💎 50')).toBeVisible({ timeout: 10000 });

  // 点击"添加奖励"
  await page.locator('button:has-text("添加奖励")').click();
  await page.locator('input[placeholder="奖励名称"]').waitFor({ state: 'visible', timeout: 5000 });

  // 填写奖励名称
  await page.locator('input[placeholder="奖励名称"]').fill('看一集动画片');

  // 填写所需积分
  await page.locator('input[placeholder="所需积分"]').fill('10');

  // 提交
  await page.locator('button[type="submit"]').click();

  // 验证奖励卡片出现
  await expect(page.locator('text=看一集动画片')).toBeVisible({ timeout: 10000 });

  // 点击"兑换"
  await page.locator('button:has-text("兑换")').click();

  // 验证积分减少到 40
  await expect(page.locator('text=💎 40')).toBeVisible({ timeout: 10000 });
});
