import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  BALANCE_STONE_BUTTONS,
  CHOICE_OPTIONS,
  DESIGN,
  QUIZ,
  REWARD,
  REVEAL_NEXT,
  STORY_NEXT,
} from '../packages/templates/src/layout';

declare global {
  interface Window {
    __chags?: { events: string[]; last: string | null };
  }
}

/** 设计分辨率坐标 → 屏幕坐标（Scale.FIT + CENTER_BOTH 的逆运算） */
async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas 还没出现');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  const offsetX = box.x + (box.width - DESIGN.width * scale) / 2;
  const offsetY = box.y + (box.height - DESIGN.height * scale) / 2;
  await page.mouse.click(offsetX + x * scale, offsetY + y * scale);
}

const events = (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__chags?.events ?? []);

test('真实点击通关：分幕 → 选错有引导 → 选对 → 搬石头 → 答题 → 典故卡', async ({ page }) => {
  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 4 幕后进入关键抉择
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, STORY_NEXT.x, STORY_NEXT.y);
    await page.waitForTimeout(60);
  }

  // 先点干扰项：必须给出引导而不是直接放行
  await clickDesign(page, CHOICE_OPTIONS[0].x, CHOICE_OPTIONS[0].y);
  await expect.poll(() => events(page)).toContain('hint:used');
  expect(await events(page)).not.toContain('choice:made:0');

  // 再点正解
  await clickDesign(page, CHOICE_OPTIONS[1].x, CHOICE_OPTIONS[1].y);
  await expect.poll(() => events(page)).toContain('choice:made');

  await clickDesign(page, REVEAL_NEXT.x, REVEAL_NEXT.y);
  await expect.poll(() => events(page)).toContain('scene:enter:balance');

  // 6 块大石头 = 3000，正好等于大象
  for (let i = 0; i < 6; i += 1) {
    await clickDesign(page, BALANCE_STONE_BUTTONS[0].x, BALANCE_STONE_BUTTONS[0].y);
    await page.waitForTimeout(60);
  }
  await expect.poll(() => events(page)).toContain('scene:enter:quiz');

  // 三道题，正确答案都是下标 1
  for (let i = 0; i < 3; i += 1) {
    await clickDesign(page, QUIZ.options[1].x, QUIZ.options[1].y);
    await page.waitForTimeout(80);
    await clickDesign(page, QUIZ.next.x, QUIZ.next.y);
    await page.waitForTimeout(80);
  }

  await expect.poll(() => events(page)).toContain('card:unlocked');
  await expect.poll(() => events(page)).toContain('level:complete');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

test('autoplay 全流程 + 刷新后进度还在', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('session:exit');

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.getByRole('button', { name: '我的图鉴' }).click();
  await expect(page.getByTestId('album-card-caochong-elephant')).toBeVisible();
});
