import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.describe('Child Switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await injectTaskFixture(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('shows current child in sidebar', async ({ page }) => {
    // 桌面视口
    await page.setViewportSize({ width: 1280, height: 800 });

    // 侧边栏应显示孩子名称
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=宝贝')).toBeVisible({ timeout: 10000 });
  });

  test('opens dropdown with add child option', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 点击孩子切换器
    const switcher = page.locator('aside button:has-text("宝贝")');
    await expect(switcher).toBeVisible({ timeout: 10000 });
    await switcher.click();

    // 下拉菜单中应有"添加孩子"
    await expect(page.locator('text=添加孩子')).toBeVisible({ timeout: 5000 });
  });

  test('can add a second child from sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 打开切换器 → 添加孩子
    await page.locator('aside button:has-text("宝贝")').click();
    await page.locator('text=添加孩子').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('text=添加孩子').click();
    await page.locator('input[placeholder="请输入孩子姓名"]').waitFor({ state: 'visible', timeout: 5000 });

    // 填写表单
    await page.locator('input[placeholder="请输入孩子姓名"]').fill('小红');
    await page.locator('button:has-text("👧")').click();
    await page.locator('button:has-text("保存")').click();

    // 再次打开切换器，应该看到两个孩子
    await page.locator('aside button:has-text("宝贝")').click();
    await expect(page.locator('[role="menuitem"]:has-text("小红")')).toBeVisible({ timeout: 5000 });
  });

  test('can switch between children', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 先添加第二个孩子
    await page.locator('aside button:has-text("宝贝")').click();
    await page.locator('text=添加孩子').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('text=添加孩子').click();
    await page.locator('input[placeholder="请输入孩子姓名"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('input[placeholder="请输入孩子姓名"]').fill('小红');
    await page.locator('button:has-text("保存")').click();
    await page.locator('aside button:has-text("宝贝")').waitFor({ state: 'visible', timeout: 10000 });

    // 打开切换器，选择小红
    await page.locator('aside button:has-text("宝贝")').click();
    await page.locator('[role="menuitem"]:has-text("小红")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[role="menuitem"]:has-text("小红")').click();

    // 侧边栏应显示小红
    await expect(page.locator('aside button:has-text("小红")')).toBeVisible({ timeout: 5000 });
  });
});
