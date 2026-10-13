import { expect, test } from '@playwright/test';
import { clickDesign, dragDesign, events } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface StageScript { template: string; levelScript: unknown }

/** Playwright 的 ESM 加载器不接受裸 JSON 导入，这里自己读 */
function loadContent(id: string): { game: { stages: StageScript[] } } {
  const path = fileURLToPath(new URL('../packages/content/src/allusions/' + id + '.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { game: { stages: StageScript[] } };
}

const panguJson = loadContent('pangu');

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
interface PlaceScript {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
}

const panguPlace = panguJson.game.stages[1]!.levelScript as unknown as PlaceScript;

test('盘古：点蛋 → 连点撑天 → 拖光球化身，真实操作通关', async ({ page }) => {
  await page.goto('/#/play/pangu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 两幕故事
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(320);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:chaos');

  // ① 连点蛋壳 4 次，混沌炸开
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(130);
  }
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('scene:enter:grow');

  // ② 连点 30 次，把天撑到一万八千年
  for (let i = 0; i < 30; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(55);
  }
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('scene:enter:place');

  // ③ 六个部位各归各位
  for (const orb of panguPlace.orbs) {
    const slot = panguPlace.slots.find((s) => s.id === orb.slotId);
    if (!slot) throw new Error('光球 ' + orb.id + ' 找不到槽位');
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(200);
  }

  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('card:unlocked');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('level:complete');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

test('盘古 autoplay 全流程 + 进度落盘', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/pangu');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('collected-count')).toHaveText('1');
  await page.reload();
  await expect(page.getByTestId('collected-count')).toHaveText('1');
});
test('中英文切换：界面与典故内容都跟着变，并且记得住选择', async ({ page }) => {
  // ?lang=en 优先
  await page.goto('/?lang=en');
  await expect(page.getByTestId('hall')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
  await expect(page.getByText('Cao Chong Weighs the Elephant')).toBeVisible();
  await expect(page.getByText('Pangu Splits Heaven and Earth')).toBeVisible();
  await expect(page.getByTestId('start-pangu')).toHaveText('Play');

  // 用英文内容玩一局，典故卡也应是英文
  await page.goto('/?lang=en&autoplay=1#/play/pangu');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await page.getByTestId('nav-album').click();
  await expect(page.getByTestId('album-card-pangu')).toContainText('Pangu Splits Heaven and Earth');
  await expect(page.getByTestId('album-card-pangu')).toContainText('Source');

  // 切回中文
  await page.getByTestId('nav-lang').click();
  await expect(page.getByRole('heading', { name: '我的典故图鉴' })).toBeVisible();

  // 不带 ?lang= 重新进入（会回到典故馆）：应该记得刚才选的"中文"
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '典故馆' })).toBeVisible();

  // 再切到英文，同样记得住
  await page.getByTestId('nav-lang').click();
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
});
