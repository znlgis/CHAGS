import { expect, test } from '@playwright/test';

/**
 * 外壳的几条"零覆盖"路径。它们都不涉及 Phaser，却都是孩子真的会碰到的：
 * 图鉴还是空的时候、点了一个不存在的游戏、地址栏里是一段看不懂的 hash。
 */
test('图鉴空态：一张卡都没有时给一句人话，而不是空白页', async ({ page }) => {
  await page.goto('/#/album');
  await expect(page.getByTestId('album')).toBeVisible();
  await expect(page.getByTestId('album')).toContainText('还没有收集到图鉴卡');
  // 空态不该出现任何卡片或分组标题
  await expect(page.locator('[data-testid^="album-card-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="album-group-"]')).toHaveCount(0);
});

test('不存在的游戏：给一句人话 + 一个出口，技术细节留给控制台', async ({ page }) => {
  await page.goto('/#/play/not-a-real-game');
  await expect(page.getByText('找不到这个游戏：')).toBeVisible();
  // 详情进 window.__chags.lastError，屏幕上不该出现 zod 的报错原文
  await expect(page.locator('body')).not.toContainText('"code"');
  await page.getByRole('button', { name: '回游戏馆' }).click();
  await expect(page.getByTestId('hall')).toBeVisible();
});

test('看不懂的 hash 一律回游戏馆，不白屏', async ({ page }) => {
  await page.goto('/#/this/does/not/exist');
  await expect(page.getByTestId('hall')).toBeVisible();
  // 没有 id 的 review 也回游戏馆
  await page.goto('/#/review');
  await expect(page.getByTestId('hall')).toBeVisible();
});

test('英文模式下外壳文案跟着变，且 html lang 同步', async ({ page }) => {
  await page.goto('/?lang=en');
  await expect(page.getByTestId('hall')).toBeVisible();
  await expect(page.getByTestId('nav-album')).toContainText('My Album');
  expect(await page.getAttribute('html', 'lang')).toBe('en');
});
