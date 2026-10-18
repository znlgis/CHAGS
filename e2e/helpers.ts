import type { Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN } from '@chags/templates/layout';

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

/* ---------------- 内容目录：清单从数据来，不手抄 ----------------
 *
 * 之前 e2e 里手抄了 36 条计策的清单（smoke.spec.ts 42 行、audit.spec.ts 36 行）：
 * 新增一部游戏时，抄漏了不会有任何测试发现 —— 它会悄悄不跑。
 * 内容目录（@chags/content 的 entries/<id>.json）就是唯一事实：
 * 摘要那半有 group / title / stratagem.number，详情那半（<id>.game.json）有关卡脚本。
 */

interface EntrySummary {
  id: string;
  group: string;
  title: string;
  stratagem?: { number: number; set: number };
}

interface StageScript {
  template: string;
  levelScript: unknown;
}

/**
 * 内容目录：由 '@chags/content/full' 的解析结果反推，不再手写跨包相对路径。
 * import.meta.resolve 只解析模块位置、不执行模块（content 包会被 Playwright 的
 * ESM 加载器挡在 53 份 JSON import 上），所以这里取到 detail.ts 再取它的目录。
 */
function entriesDir(): string {
  return dirname(fileURLToPath(import.meta.resolve('@chags/content/full')));
}

/** 内容目录里的所有条目（摘要那半；详情 <id>.game.json 不算一条内容） */
function entryFileNames(): string[] {
  return readdirSync(entriesDir()).filter(
    (name) => name.endsWith('.json') && !name.endsWith('.game.json'),
  );
}

function readSummary(name: string): EntrySummary {
  return JSON.parse(readFileSync(join(entriesDir(), name), 'utf8')) as EntrySummary;
}

/** 内容目录里的所有内容 id */
export function allEntryIds(): string[] {
  return entryFileNames()
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

/**
 * 某一组（'allusion' / 'stratagem'）的内容摘要。
 * 三十六计按计策序号排（1–36），其余按 id 排。
 */
export function entrySummaries(group: string): EntrySummary[] {
  return entryFileNames()
    .map(readSummary)
    .filter((entry) => entry.group === group)
    .sort((a, b) => (a.stratagem?.number ?? 0) - (b.stratagem?.number ?? 0) || a.id.localeCompare(b.id));
}

/** 某一组的内容 id —— 数量随时长，用例不写死 */
export function entryIdsInGroup(group: string): string[] {
  return entrySummaries(group).map((entry) => entry.id);
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** 读一局的内容详情（含关卡脚本与复习题）。Playwright 的 ESM 加载器不接受裸 JSON 导入 */
export function loadContent(id: string): {
  game: { stages: StageScript[] };
  quiz: QuizQuestion[];
} {
  const path = join(entriesDir(), id + '.game.json');
  return JSON.parse(readFileSync(path, 'utf8')) as {
    game: { stages: StageScript[] };
    quiz: QuizQuestion[];
  };
}

