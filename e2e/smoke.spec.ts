import { expect, test } from '@playwright/test';
import { clickDesign, dragDesign, events } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';

const BOAT = { x: SUB.boatX, y: 600 };

test('真实操作通关：拖大象上船 → 刻水痕 → 搬石头 → 称出重量', async ({ page }) => {
  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 两幕故事：点哪都行
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(300);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:substitution');

  // ① 试着直接上秤 —— 秤会垮，船才是出路
  await dragDesign(page, SUB.heavyHome, { x: SUB.scalePos.x, y: SUB.scalePos.y - 40 });
  await page.waitForTimeout(700);
  expect(await events(page)).toContain('choice:made:scale');
  expect(await events(page)).not.toContain('scene:enter:reward');

  // ② 把大象拖上船
  await dragDesign(page, SUB.heavyHome, BOAT);
  await page.waitForTimeout(900);

  // ③ 在水痕处刻一刀
  await clickDesign(page, SUB.boatX, SUB.waterTop - 60);
  await expect.poll(() => events(page)).toContain('choice:made:carve');

  // ④ 一块块搬石头，直到水痕回到水面（6 × 500 = 3000）
  await expect.poll(() => events(page)).toContain('beat:enter:substitute');
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i += 1) {
    await dragDesign(page, SUB_PILES[0], BOAT);
    await page.waitForTimeout(120);
  }

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

test('autoplay 全流程 + 刷新后进度还在', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.getByRole('button', { name: '我的图鉴' }).click();
  await expect(page.getByTestId('album-card-caochong-elephant')).toBeVisible();
});
