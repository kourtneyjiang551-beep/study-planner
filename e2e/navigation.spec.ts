import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test('landing page redirects to dashboard', async ({ page }) => {
  // 先注入数据确保不触发引导向导
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
});

test('sidebar navigation reaches all pages', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const links = [
    { text: '统计分析', url: '/dashboard/stats' },
    { text: '成绩管理', url: '/dashboard/grades' },
    { text: '勋章墙', url: '/dashboard/medals' },
    { text: '积分奖励', url: '/dashboard/rewards' },
    { text: '设置', url: '/dashboard/settings' },
  ];

  for (const link of links) {
    await page.locator(`nav >> text=${link.text}`).first().click();
    await expect(page).toHaveURL(link.url);
    await page.waitForLoadState('networkidle');
  }
});
