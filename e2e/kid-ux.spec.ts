import { expect, test } from '@playwright/test';
import { clickDesign, events, waitEvent } from './helpers';

/**
 * 适龄体验与安全边界（2026-10-18 产品审查后新增）：
 * 声音可控、游戏内能退出、家长页、20 分钟休息提醒、二周目跳过故事、再来一次。
 *
 * 这些不是玩法，但直接决定"孩子愿不愿意再玩"和"家长放不放心"。
 */

test('声音开关：点一下就静音，并记住选择', { tag: '@real' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  await page.getByTestId('nav-sound').click();
  expect(await page.evaluate(() => window.localStorage.getItem('chags.muted'))).toBe('1');
  // 再点一次恢复
  await page.getByTestId('nav-sound').click();
  expect(await page.evaluate(() => window.localStorage.getItem('chags.muted'))).toBe('0');
});

test('游戏内能退出：确认层挡误触，想退随时能退', { tag: '@real' }, async ({ page }) => {
  await page.goto('/?story=instant#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  await page.getByTestId('play-leave').click();
  await expect(page.getByTestId('play-leave-confirm')).toBeVisible();
  // 误触想继续玩：回到游戏，还在这一局里
  await page.getByTestId('play-leave-stay').click();
  await expect(page.getByTestId('play-leave-confirm')).toBeHidden();
  await expect(page.getByTestId('hall')).toBeHidden();

  // 真的想走：回游戏馆
  await page.getByTestId('play-leave').click();
  await page.getByTestId('play-leave-exit').click();
  await expect(page.getByTestId('hall')).toBeVisible();
});

test('家长页：长按标题 3 秒进入，孩子点不进去', { tag: '@real' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  const title = page.getByTestId('app-title');
  const box = await title.boundingBox();
  if (box === null) throw new Error('标题还没出现');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
  await expect(page.getByTestId('parent')).toBeVisible();
  await expect(page.getByTestId('parent-sound')).toBeVisible();
  await page.getByTestId('parent-back').click();
  await expect(page.getByTestId('hall')).toBeVisible();
});

test('玩了 20 分钟：大厅出现一次休息提醒，点过就收起', { tag: '@real' }, async ({ page }) => {
  const now = new Date();
  const date =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  await page.addInitScript((day) => {
    window.localStorage.setItem(
      'chags.playtime',
      JSON.stringify({ date: day, seconds: 20 * 60, rounds: 4, reminded: false }),
    );
  }, date);
  await page.goto('/');
  const rest = page.getByTestId('hall-rest');
  await expect(rest).toBeVisible();
  await page.getByTestId('hall-rest-ok').click();
  await expect(rest).toBeHidden();
  const saved = await page.evaluate(() => window.localStorage.getItem('chags.playtime'));
  expect(saved).toContain('"reminded":true');
});

test('二周目可以跳过故事：已经通关过才出现', { tag: '@real' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  // 第一次：正常听完故事再进玩法（这里用无头通关快速收集卡片）
  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  // 第二次：不带 autoplay 进同一局 —— 故事页应出现"跳过故事"
  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('scene:enter:story');
  await clickDesign(page, 750 - 138, 228);
  expect(await waitEvent(page, 'choice:made:skip', 5000), '点了跳过应发 story:skip').toBe(true);
  await expect.poll(() => events(page), { timeout: 10_000 }).toContain('scene:enter:substitution');
});

test('典故卡上有「再来一次」：原地重开，不用回大厅', { tag: '@real' }, async ({ page }) => {
  await page.goto('/?autoplay=1&card=hold#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('card:unlocked');
  const before = (await events(page)).filter((event) => event === 'session:start').length;
  // 卡片左下的「再来一次」
  await clickDesign(page, 375 - 168, 1190);
  await expect
    .poll(async () => (await events(page)).filter((event) => event === 'session:start').length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(before);
});