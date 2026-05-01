import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('add a grade and see it displayed', async ({ page }) => {
  await page.goto('/dashboard/grades');
  await page.waitForLoadState('networkidle');

  // 点击"添加成绩"按钮
  await page.locator('button:has-text("添加成绩")').click();
  await page.locator('input[placeholder="考试名称"]').waitFor({ state: 'visible', timeout: 5000 });

  // 填写考试名称
  await page.locator('input[placeholder="考试名称"]').fill('期中数学测验');

  // 选择考试类型
  await page.locator('select[name="exam_type"]').selectOption('期中考试');

  // 填写日期
  await page.locator('input[name="exam_date"]').fill('2026-04-01');

  // 填写分数
  await page.locator('input[name="score"]').fill('92');
  const totalInput = page.locator('input[name="total_score"]');
  await totalInput.clear();
  await totalInput.fill('100');

  // 选择年级
  await page.locator('select[name="grade_level"]').selectOption('三年级');

  // 选择学期
  await page.locator('select[name="semester"]').selectOption('下学期');

  // 提交
  await page.locator('button[type="submit"]').click();

  // 验证成绩卡片出现
  await expect(page.locator('text=期中数学测验')).toBeVisible({ timeout: 10000 });
});
