import { expect, test } from '@playwright/test';
import { clickDesign, events, waitEvent } from './helpers';

/**
 * 按钮命中区回归 —— 守的是「点得中」这件事本身。
 *
 * 2026-10 的真实 bug：`BaseScene.addButton` 把命中区写成 `Rectangle(-w/2, -h/2, w, h)`。
 * Phaser 在命中测试前会把局部坐标**加上 displayOrigin**（Container 恒为 width/2, height/2），
 * 于是可点区变成「与按钮同尺寸、但整体左上偏移半个按钮」的矩形：
 * 只有按钮的**左上四分之一**能点中，正中心恰好压在闭区间边界上（偶尔点得中）。
 * 孩子看到的是：戳按钮中间没反应，手抖偏一点又好了 —— "比较随机"。
 *
 * 所以这里的用例**故意不点按钮中心**（旧代码在正中心是靠运气过的），而是点视觉的
 * 右下区域：那里在旧代码里百分之百没反应。e2e/helpers 的 clickDesign 走的是
 * 设计分辨率坐标，和真实手指落点是同一条换算链路。
 */

/** 典故卡的「再来一次」：中心 (375-168, 1190)，尺寸 288×104 */
const REWARD_AGAIN = { x: 375 - 168, y: 1190, w: 288, h: 104 };

test('典故卡「再来一次」：点按钮右下角也要有反应（旧代码只有左上 1/4 能点）', async ({ page }) => {
  await page.goto('/?autoplay=1&card=hold#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('card:unlocked');

  const before = (await events(page)).filter((event) => event === 'session:start').length;
  // 视觉的右下区域：偏移 (+120, +44) —— 仍在按钮内，但离中心很远
  await clickDesign(
    page,
    REWARD_AGAIN.x + REWARD_AGAIN.w * 0.42,
    REWARD_AGAIN.y + REWARD_AGAIN.h * 0.42,
  );
  await expect
    .poll(async () => (await events(page)).filter((event) => event === 'session:start').length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(before);
});

test('一根手指按着时，另一根指点按钮也要生效（多点触控）', async ({ browser }) => {
  /**
   * Phaser 默认 input.activePointers = 1：一根手指按在屏幕上（扶屏、连点、长按、
   * 拖到一半）时，第二个 touchstart 找不到空闲指针会被整条丢弃 —— 孩子看到的就是
   * "点几次都没反应，有时候突然又有反应"。createGame.ts 现在给 3 个触点。
   */
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const toScreen = async (x: number, y: number): Promise<{ x: number; y: number }> => {
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('canvas 还没出现');
    const scale = Math.min(box.width / 750, box.height / 1334);
    const ox = box.x + (box.width - 750 * scale) / 2;
    const oy = box.y + (box.height - 1334 * scale) / 2;
    return { x: ox + x * scale, y: oy + y * scale };
  };
  const touch = (type: 'touchStart' | 'touchEnd', points: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, index) => ({
        x: point.x, y: point.y, id: index + 1, radiusX: 12, radiusY: 12, force: 1,
      })),
    });

  await page.goto('/?autoplay=1&card=hold#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('card:unlocked');

  const before = (await events(page)).filter((event) => event === 'session:start').length;
  const blank = await toScreen(375, 700); // 空白处：第一根手指按住不放
  const button = await toScreen(REWARD_AGAIN.x, REWARD_AGAIN.y); // 第二根手指点「再来一次」

  await touch('touchStart', [blank]);
  await page.waitForTimeout(80);
  await touch('touchStart', [blank, button]);
  await page.waitForTimeout(80);
  await touch('touchEnd', [blank]);
  await expect
    .poll(async () => (await events(page)).filter((event) => event === 'session:start').length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(before);
  await touch('touchEnd', []);
  await context.close();
});

test('故事页「跳过故事」：点按钮右下角也要有反应', { tag: '@real' }, async ({ page }) => {
  // 二周目才会出现「跳过故事」
  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');

  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('scene:enter:story');

  // 跳过按钮：中心 (750-138, 228)，尺寸 236×92 → 点视觉右下区域
  await clickDesign(page, 750 - 138 + 236 * 0.35, 228 + 92 * 0.35);
  expect(await waitEvent(page, 'choice:made:skip', 5000), '点了跳过应发 story:skip').toBe(true);
  await expect.poll(() => events(page), { timeout: 10_000 }).toContain('scene:enter:substitution');
});
