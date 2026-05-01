/* eslint-disable @typescript-eslint/no-explicit-any -- E2E test: window.__testDB is untyped dev bridge */
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

/** 注入带 PIN 的 profile */
async function injectWithPin(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).__testDB !== undefined, { timeout: 10000 });
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    const ts = new Date().toISOString();
    // bcryptjs hash of "1234"
    const pinHash = '$2b$10$OdgScOvOZajyDUDbZ2nYQeba35LBZxRjcBzJNQz5a1h9ufE57RfoS';

    await db.profiles.put({
      id: 'default-profile',
      display_name: '测试用户',
      avatar: '',
      current_theme: 'dojo',
      parent_pin_hash: pinHash,
      last_active_child_id: 'default-child',
      created_at: ts,
      updated_at: ts,
    });
    await db.children.put({
      id: 'default-child',
      profile_id: 'default-profile',
      name: '宝贝',
      avatar: '',
      grade: '三年级',
      current_points: 50,
      streak_days: 0,
      created_at: ts,
      updated_at: ts,
    });
  });
}

test.describe('PIN Verification', () => {
  test('settings accessible without PIN when not set', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await injectTaskFixture(page);
    // 需要 reload 让 ActiveChildProvider 感知新注入的数据
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 无 PIN 时直接看到设置内容
    await expect(page.getByRole('heading', { name: '孩子管理' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /PIN/ })).toBeVisible();
  });

  test('shows PIN gate when PIN is set', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await injectWithPin(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 清除 session 验证标记
    await page.evaluate(() => sessionStorage.removeItem('study-planner-pin-verified'));

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 应显示 PIN 验证页面
    await expect(page.locator('text=家长验证')).toBeVisible({ timeout: 10000 });

    // 应有 4 个 PIN 输入框
    const pinInputs = page.locator('input[inputmode="numeric"]');
    await expect(pinInputs).toHaveCount(4);
  });

  test('can set PIN from settings', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await injectTaskFixture(page);

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 点击设置 PIN 保护
    await page.locator('button:has-text("设置 PIN 保护")').click();
    let inputs = page.locator('input[inputmode="numeric"]');
    await expect(inputs).toHaveCount(4, { timeout: 5000 });

    // 输入 PIN: 1234
    for (let i = 0; i < 4; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    // 等待确认步骤出现
    await expect(page.locator('text=请再次输入确认')).toBeVisible({ timeout: 10000 });

    // 确认 PIN: 1234
    inputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    // 应显示 PIN 保护已开启
    await expect(page.locator('text=PIN 保护已开启')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings Child Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await injectTaskFixture(page);
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('shows child management section with child name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '孩子管理' })).toBeVisible({ timeout: 10000 });
    // 宝贝 在侧边栏和设置页都出现, 用 main 区域限定
    await expect(page.getByRole('main').locator('text=宝贝').first()).toBeVisible();
  });

  test('can add a child from settings', async ({ page }) => {
    await page.getByRole('main').locator('button:has-text("添加孩子")').click();
    await page.locator('input[type="text"]').waitFor({ state: 'visible', timeout: 5000 });

    await page.locator('input[type="text"]').fill('小花');
    await page.locator('button:has-text("保存")').click();

    await expect(page.getByRole('main').locator('text=小花')).toBeVisible({ timeout: 5000 });
  });

  test('preserves theme and data sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '主题切换' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: '数据管理' })).toBeVisible();
    await expect(page.locator('button:has-text("导出备份")')).toBeVisible();
  });
});
