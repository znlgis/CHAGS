import type { Page } from '@playwright/test';
import { DESIGN } from '../packages/templates/src/layout';

import type { ChagsDebugBridge } from '../apps/site/src/shell/debug';

declare global {
  interface Window {
    __chags?: ChagsDebugBridge;
  }
}

export async function toScreen(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas 还没出现');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  const ox = box.x + (box.width - DESIGN.width * scale) / 2;
  const oy = box.y + (box.height - DESIGN.height * scale) / 2;
  return { x: ox + x * scale, y: oy + y * scale };
}

/** 设计分辨率坐标 → 屏幕坐标（Scale.FIT + CENTER_BOTH 的逆运算） */
export async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const p = await toScreen(page, x, y);
  await page.mouse.click(p.x, p.y);
}

/** 真·拖拽：按下 → 分步移动 → 松手 */
export async function dragDesign(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const a = await toScreen(page, from.x, from.y);
  const b = await toScreen(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.waitForTimeout(80);
  await page.mouse.up();
}

/** 按住不放：夸父要一直按着跑 */
export async function holdDesign(
  page: Page,
  x: number,
  y: number,
  ms: number,
): Promise<void> {
  const p = await toScreen(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** 连点若干次（间隔可调），用于精卫 / 愚公这种连点玩法 */
export async function tapDesign(
  page: Page,
  x: number,
  y: number,
  times: number,
  gapMs = 130,
): Promise<void> {
  const p = await toScreen(page, x, y);
  for (let i = 0; i < times; i += 1) {
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(gapMs);
  }
}

export const events = (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__chags?.events ?? []);
/** 页面上的技术错误（有就说明游戏没起来） */
export const lastError = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__chags?.lastError);
