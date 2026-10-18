import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { beamProgressBar, SWAP_BEAM } from '@chags/templates/swap';
import type { SwapBeamStageState } from '@chags/templates';
import type { SwapBeamLevel } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';
import {
  BEAM_BOTTOM, CHECKER, CHECK_MS, PILE_BOTTOM, PILE_TOP, PODIUM_BOTTOM, PODIUM_TOP, POST_RADIUS,
  POST_Y, ROOF_BOTTOM, ROOF_TOP, SKY_TOP, STEPS,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 殿外天色、台基的石头、柱子上那层大漆（秦宫尚黑红） */
const SKY_DEEP = shade(THEME.skyDeep, 1.02);
const HILL = shade(THEME.teal, 0.72);
const STONE = THEME.stone;
const STONE_DEEP = shade(THEME.stoneDeep, 1.02);
const LACQUER = THEME.redDeep;
const LACQUER_FRESH = shade(THEME.red, 1.02);
const GOLD_BAND = THEME.gold;
const BEAM_WOOD = THEME.woodDeep;
const BEAM_WOOD_LIGHT = THEME.wood;
const SKIN = 0xf8dcbb;
const ROBE = shade(THEME.teal, 0.82);

/** 一个人 / 一根柱子的脚下那一点 */

// ---------------- 柱子上的花纹（龙 / 云 / 水 / 火） ----------------
//
// 花纹写在一个 (u, v) 的局部坐标里：v 是"柱子长的那一头"。
// 站着画的柱子 v 朝上（屏幕的 y 轴反着来），躺着画的新柱 v 朝右 ——
// 同一份花纹代码画两种朝向，孩子一眼认得出"新柱跟旧柱是一对"。

function patternLine(
  g: Phaser.GameObjects.Graphics,
  horizontal: boolean,
  cx: number,
  cy: number,
  s: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
): void {
  if (horizontal) g.lineBetween(cx + v1 * s, cy + u1 * s, cx + v2 * s, cy + u2 * s);
  else g.lineBetween(cx + u1 * s, cy + v1 * s, cx + u2 * s, cy + v2 * s);
}

function patternTriangle(
  g: Phaser.GameObjects.Graphics,
  horizontal: boolean,
  cx: number,
  cy: number,
  s: number,
  a: [number, number],
  b: [number, number],
  c: [number, number],
): void {
  if (horizontal) {
    g.fillTriangle(cx + a[1] * s, cy + a[0] * s, cx + b[1] * s, cy + b[0] * s, cx + c[1] * s, cy + c[0] * s);
  } else {
    g.fillTriangle(cx + a[0] * s, cy + a[1] * s, cx + b[0] * s, cy + b[1] * s, cx + c[0] * s, cy + c[1] * s);
  }
}

/** 一段圆弧（用折线逼近：这样躺着、站着都能画） */
function patternArc(
  g: Phaser.GameObjects.Graphics,
  horizontal: boolean,
  cx: number,
  cy: number,
  s: number,
  cu: number,
  cv: number,
  r: number,
  from: number,
  to: number,
): void {
  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    const u = cu + Math.cos(angle) * r;
    const v = cv + Math.sin(angle) * r;
    const x = horizontal ? cx + v * s : cx + u * s;
    const y = horizontal ? cy + u * s : cy + v * s;
    if (i === 0) g.beginPath();
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
}

/** 柱子中间那块牌子上的花纹：龙 / 云 / 水 / 火 */
function drawPattern(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  cx: number,
  cy: number,
  s: number,
  horizontal: boolean,
): void {
  if (kind === 'dragon') {
    // 龙纹：一条折起来的长身 + 一个头
    g.lineStyle(11 * s, THEME.tealDeep, 1);
    patternLine(g, horizontal, cx, cy, s, -20, -44, 18, -14);
    patternLine(g, horizontal, cx, cy, s, 18, -14, -18, 10);
    patternLine(g, horizontal, cx, cy, s, -18, 10, 16, 42);
    g.fillStyle(THEME.teal, 1);
    patternTriangle(g, horizontal, cx, cy, s, [-20, -60], [16, -34], [-34, -30]);
    g.fillStyle(THEME.paper, 1);
    patternArc(g, horizontal, cx, cy, s, -12, -46, 5, 0, Math.PI * 2);
    return;
  }
  if (kind === 'cloud') {
    // 云纹：三个卷起来的云头
    g.lineStyle(10 * s, THEME.tealDeep, 1);
    patternArc(g, horizontal, cx, cy, s, -22, 20, 18, 0.6, 5.6);
    patternArc(g, horizontal, cx, cy, s, 20, 8, 16, 0.6, 5.6);
    patternArc(g, horizontal, cx, cy, s, -2, -26, 15, 0.6, 5.6);
    return;
  }
  if (kind === 'wave') {
    // 水纹：三道来回的浪
    g.lineStyle(10 * s, THEME.waterDeep, 1);
    for (let i = 0; i < 3; i += 1) {
      const v = -30 + i * 30;
      patternLine(g, horizontal, cx, cy, s, -30, v, -10, v - 12);
      patternLine(g, horizontal, cx, cy, s, -10, v - 12, 10, v + 12);
      patternLine(g, horizontal, cx, cy, s, 10, v + 12, 30, v);
    }
    return;
  }
  // 火纹：三簇火苗
  g.fillStyle(THEME.gold, 1);
  patternTriangle(g, horizontal, cx, cy, s, [0, -52], [-30, 34], [30, 34]);
  g.fillStyle(THEME.red, 1);
  patternTriangle(g, horizontal, cx, cy, s, [0, -18], [-17, 30], [17, 30]);
  g.fillStyle(THEME.gold, 1);
  patternTriangle(g, horizontal, cx, cy, s, [-34, 36], [-14, 6], [-6, 36]);
  patternTriangle(g, horizontal, cx, cy, s, [34, 36], [14, 6], [6, 36]);
}

/** 花纹牌：柱身上那一块浅色的小牌子 */
function patternPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: string,
  horizontal: boolean,
  s: number,
): void {
  roundRect(g, x - w / 2, y - h / 2, w, h, 18, shade(THEME.paper, 0.94), THEME.outline, 5);
  drawPattern(g, kind, x, y, s, horizontal);
}

// ---------------- 一根承重柱 ----------------

/** 柱础：柱脚底下那块石头 */
function drawBase(g: Phaser.GameObjects.Graphics, x: number): void {
  const foot = POST_Y + POST_RADIUS;
  groundShadow(g, x, foot + 12, 176, 40, 0.18);
  roundRect(g, x - 78, foot - 16, 156, 40, 16, STONE_DEEP, THEME.outline, 5);
  g.fillStyle(shade(STONE, 1.04), 1);
  g.fillEllipse(x, foot - 16, 150, 26);
}

/**
 * 一根柱子。fresh = 已经换成新柱（漆色亮一点、箍是金的）；
 * squash 是刚立起来那一下的挤压（0.86..1）。
 */
function drawPost(
  g: Phaser.GameObjects.Graphics,
  x: number,
  kind: string,
  fresh: boolean,
  squash = 1,
): void {
  const top = BEAM_BOTTOM + (1 - squash) * 60;
  const foot = POST_Y + POST_RADIUS;
  const half = 52;
  g.fillStyle(fresh ? LACQUER_FRESH : LACQUER, 1);
  g.fillRoundedRect(x - half, top, half * 2, foot - top, 24);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - half, top, half * 2, foot - top, 24);
  // 柱头与柱脚的两道箍：新柱用金的，旧柱用暗金（一眼看得出哪根换过了）
  g.fillStyle(fresh ? GOLD_BAND : shade(THEME.goldDeep, 0.92), 1);
  g.fillRect(x - half, top + 22, half * 2, 14);
  g.fillRect(x - half, foot - 40, half * 2, 12);
  // 柱身中间那一块花纹牌
  patternPanel(g, x, (top + foot) / 2 + 6, 82, 148, kind, false, 0.92);
}

/** 料堆里躺着的一根新柱（花纹跟柱子一样，只是横过来） */
function drawSpare(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: string): void {
  groundShadow(g, x, y + 30, 148, 30, 0.16);
  roundRect(g, x - 66, y - 32, 132, 64, 22, LACQUER_FRESH, THEME.outline, 6);
  g.fillStyle(GOLD_BAND, 1);
  g.fillRect(x - 58, y - 30, 10, 60);
  g.fillRect(x + 48, y - 30, 10, 60);
  // 两道捆着的绳
  g.lineStyle(5, THEME.woodDeep, 0.9);
  g.lineBetween(x - 34, y - 34, x - 34, y + 34);
  g.lineBetween(x + 34, y - 34, x + 34, y + 34);
  patternPanel(g, x, y, 96, 64, kind, true, 0.5);
}

// ---------------- 检查的人（监工） ----------------

/**
 * 台基下面站着的监工。他每隔 checkMs 走一趟清点 ——
 * walk 是"这一趟走到哪儿了"（0 = 站在台阶下，1 = 走到台基上）。
 */
function drawChecker(g: Phaser.GameObjects.Graphics, walk: number): void {
  const x = CHECKER.x;
  const y = CHECKER.y - walk * 96;
  groundShadow(g, x, y + 6, 96, 24, 0.18);
  // 身子：一件深色的官袍
  roundRect(g, x - 30, y - 96, 60, 98, 20, ROBE, THEME.outline, 6);
  g.lineStyle(8, THEME.gold, 1);
  g.lineBetween(x - 28, y - 52, x + 28, y - 52);
  circle(g, x, y - 118, 24, SKIN, THEME.outline, 6);
  // 头上的冠
  roundRect(g, x - 26, y - 142, 52, 16, 8, THEME.inkSoft, THEME.outline, 5);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillEllipse(x, y - 152, 44, 22);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 8, y - 118, 3.4);
  g.fillCircle(x + 8, y - 118, 3.4);
  // 手里那盏灯：清点的时候举起来
  const lift = 26 + walk * 54;
  g.lineStyle(7, THEME.woodDeep, 1);
  g.lineBetween(x + 26, y - 70, x + 44, y - 70 - lift);
  g.fillStyle(THEME.gold, 0.22 + walk * 0.4);
  g.fillCircle(x + 46, y - 76 - lift, 30 + walk * 16);
  circle(g, x + 45, y - 78 - lift, 14, THEME.gold, THEME.outline, 4);
}

/** 清点的那一趟走到哪儿了（0..1） */
function countWalk(state: SwapBeamStageState): number {
  if (state.lastCheckAtMs < 0) return 0;
  const since = state.elapsedMs - state.lastCheckAtMs;
  if (since < 0 || since > SWAP_BEAM.sweepMs) return 0;
  return clamp01(since / SWAP_BEAM.sweepMs);
}

// ---------------- 景（画一次） ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: SwapBeamLevel): void {
  // 殿外的天色
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  g.fillStyle(SKY_DEEP, 1);
  g.fillRect(0, SKY_TOP, W, 240);
  // 远处的宫墙与两座偏殿
  g.fillStyle(HILL, 0.5);
  g.fillEllipse(140, 336, 520, 200);
  g.fillEllipse(620, 356, 560, 220);
  g.fillStyle(shade(THEME.redDeep, 0.72), 0.5);
  g.fillTriangle(30, ROOF_BOTTOM, 300, ROOF_BOTTOM, 160, ROOF_TOP + 30);
  g.fillTriangle(450, ROOF_BOTTOM, 730, ROOF_BOTTOM, 590, ROOF_TOP + 30);

  // 大殿的屋顶：一条正脊 + 两坡瓦 + 两头上翘的檐角
  g.fillStyle(shade(THEME.tealDeep, 0.9), 1);
  g.fillTriangle(-30, ROOF_BOTTOM, W + 30, ROOF_BOTTOM, W / 2, ROOF_TOP);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeTriangle(-30, ROOF_BOTTOM, W + 30, ROOF_BOTTOM, W / 2, ROOF_TOP);
  g.fillStyle(shade(THEME.teal, 0.86), 1);
  g.fillTriangle(-30, ROOF_BOTTOM, W / 2, ROOF_BOTTOM - 16, W / 2, ROOF_TOP);
  g.lineStyle(5, shade(THEME.outline, 1), 0.35);
  for (let i = 1; i < 6; i += 1) {
    const p = i / 6;
    const left = -30 + (W / 2 + 30) * p;
    g.lineBetween(left, ROOF_BOTTOM, W / 2, ROOF_TOP + (ROOF_BOTTOM - ROOF_TOP) * (1 - p) * 0.02);
  }
  // 正脊与两头的鸱吻
  roundRect(g, -30, ROOF_TOP - 26, W + 60, 30, 12, shade(THEME.tealDeep, 0.78), THEME.outline, 5);
  g.fillStyle(shade(THEME.goldDeep, 1), 1);
  g.fillTriangle(-24, ROOF_TOP - 26, 34, ROOF_TOP - 26, 4, ROOF_TOP - 78);
  g.fillTriangle(W + 24, ROOF_TOP - 26, W - 34, ROOF_TOP - 26, W - 4, ROOF_TOP - 78);

  // 大梁：四根柱子顶着它（这一关的"梁"）
  roundRect(g, -20, ROOF_BOTTOM, W + 40, BEAM_BOTTOM - ROOF_BOTTOM, 10, BEAM_WOOD, THEME.outline, 6);
  g.fillStyle(BEAM_WOOD_LIGHT, 0.55);
  g.fillRect(-20, ROOF_BOTTOM + 10, W + 40, 12);
  for (const x of [96, 282, 468, 654]) {
    roundRect(g, x - 26, BEAM_BOTTOM - 12, 52, 26, 8, shade(BEAM_WOOD, 0.86), THEME.outline, 5);
  }

  // 台基：一层压一层的石头
  roundRect(g, -10, PODIUM_TOP, W + 20, PODIUM_BOTTOM - PODIUM_TOP, 12, STONE, THEME.outline, 6);
  g.lineStyle(4, shade(STONE, 0.86), 1);
  for (let y = PODIUM_TOP + 74; y < PODIUM_BOTTOM; y += 74) g.lineBetween(0, y, W, y);
  for (let row = 0; row < 5; row += 1) {
    const y = PODIUM_TOP + 74 + row * 74;
    for (let x = row % 2 === 0 ? 0 : 62; x < W; x += 124) g.lineBetween(x, y - 74, x, y);
  }
  // 台基下面的三级石阶
  for (const step of STEPS) {
    roundRect(g, (W - step.w) / 2, step.y, step.w, 52, 10, shade(STONE, 0.94), THEME.outline, 5);
    g.fillStyle(shade(STONE, 1.05), 0.7);
    g.fillRect((W - step.w) / 2 + 12, step.y + 8, step.w - 24, 10);
  }

  // 料堆：垫在地上的一块席子（新柱由 drawStage 一根根画上去）
  g.fillStyle(shade(THEME.sandDeep, 0.5), 0.5);
  g.fillRoundedRect(14, PILE_TOP, W - 28, PILE_BOTTOM - PILE_TOP, 40);
  g.lineStyle(4, shade(THEME.sand, 0.78), 0.6);
  g.strokeRoundedRect(14, PILE_TOP, W - 28, PILE_BOTTOM - PILE_TOP, 40);
  g.lineStyle(5, shade(THEME.sand, 0.86), 0.55);
  for (let i = 0; i < 10; i += 1) {
    const sx = 48 + i * 72;
    const sy = PILE_TOP + 30 + (i % 3) * 34;
    g.lineBetween(sx, sy + 16, sx + 30, sy - 8);
  }

  // 四根柱子的柱础：位置先摆好（柱子本身由 drawStage 画）
  for (const post of level.posts) drawBase(g, post.x);
  // 监工站在台阶下（清点的时候走上来）
  drawChecker(g, 0);
}

// ---------------- 每帧 ----------------

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: SwapBeamStageState,
  level: SwapBeamLevel,
): void {
  // 监工：清点的那一趟
  drawChecker(g, countWalk(state));

  // 四根柱子：换好的立的是新柱
  for (const post of level.posts) {
    const fresh = state.rebuilt.includes(post.id);
    const justDone = state.lastRebuiltPost === post.id;
    const since = state.elapsedMs - state.lastRebuiltAtMs;
    const squash = justDone && since >= 0 && since <= SWAP_BEAM.standMs
      ? 0.86 + 0.14 * clamp01(since / SWAP_BEAM.standMs)
      : 1;
    drawPost(g, post.x, post.kind, fresh, squash);
  }

  // 料堆里的新柱：已经搬上去的那几根就不在了
  const used = new Set(Object.values(state.covers));
  for (const spare of level.spares) {
    if (used.has(spare.id)) continue;
    drawSpare(g, spare.x, spare.y, spare.kind);
  }

  // 还有几根没换：脚下那一点"还等着"的暗影（一眼看出还剩几根）
  const left = level.posts.filter((post) => !state.rebuilt.includes(post.id));
  if (left.length > 0 && !state.done) {
    const breathe = 0.5 + 0.5 * Math.sin(state.elapsedMs / 300);
    for (const post of left) {
      g.lineStyle(6, THEME.gold, 0.16 + 0.2 * breathe);
      g.strokeEllipse(post.x, POST_Y + POST_RADIUS + 26, 168 + 10 * breathe, 36);
    }
  }

  // 清点的钟：监工脚边那一圈刻度（离下一次清点越近，圈越满）
  if (!state.done) {
    const left = clamp01(1 - state.nextCheckInMs / CHECK_MS);
    g.lineStyle(7, THEME.inkSoft, 0.35);
    g.strokeCircle(CHECKER.x, CHECKER.y + 34, 34);
    g.lineStyle(9, left > 0.82 ? THEME.red : THEME.gold, 0.9);
    g.beginPath();
    g.arc(CHECKER.x, CHECKER.y + 34, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    g.strokePath();
  }

  // 换好了几根 / 一共几根
  beamProgressBar(g, level, state.rebuiltCount);
}

/** 收尾：四根都是新柱，梁还稳稳地压在上面；监工举着灯，什么也没看出来 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: SwapBeamStageState,
  level: SwapBeamLevel,
): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillEllipse(W / 2, POST_Y - 40, 700, 520);
  for (const post of level.posts) {
    g.lineStyle(9, THEME.gold, 0.42);
    g.strokeCircle(post.x, (BEAM_BOTTOM + POST_Y + POST_RADIUS) / 2, 104);
  }
  // 监工头上的一个问号：他清点过了，却说不出哪里不对
  const x = CHECKER.x + 62;
  const y = CHECKER.y - 196;
  g.lineStyle(9, THEME.inkSoft, 0.9);
  g.beginPath();
  g.arc(x, y, 22, Math.PI * 0.9, Math.PI * 2.1);
  g.strokePath();
  g.lineBetween(x + 18, y + 14, x + 6, y + 34);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillCircle(x + 4, y + 54, 6);
  void state;
}

// ---------------- 分幕插图 ----------------

/** 一个小人（插图里用）：一站一坐的简笔 */
function drawCourtier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  color: number,
): void {
  groundShadow(g, x, y + 4 * scale, 62 * scale, 16 * scale, 0.16);
  roundRect(g, x - 20 * scale, y - 66 * scale, 40 * scale, 70 * scale, 14 * scale, color, THEME.outline, 5);
  circle(g, x, y - 84 * scale, 17 * scale, SKIN, THEME.outline, 5);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillEllipse(x, y - 104 * scale, 34 * scale, 16 * scale);
}

/** 一头鹿（插图里用）：身子 + 四条腿 + 一对角 */
function drawDeer(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
  groundShadow(g, x, y + 4 * scale, 150 * scale, 26 * scale, 0.18);
  const body = shade(THEME.wood, 1.08);
  g.lineStyle(10 * scale, shade(THEME.woodDeep, 1), 1);
  for (const dx of [-44, -18, 20, 46]) {
    g.lineBetween(x + dx * scale, y - 52 * scale, x + dx * scale, y);
  }
  g.fillStyle(body, 1);
  g.fillEllipse(x, y - 74 * scale, 168 * scale, 66 * scale);
  g.lineStyle(5 * scale, THEME.outline, 1);
  g.strokeEllipse(x, y - 74 * scale, 168 * scale, 66 * scale);
  // 脖子与头
  g.fillStyle(body, 1);
  g.fillTriangle(x + 62 * scale, y - 106 * scale, x + 96 * scale, y - 106 * scale, x + 92 * scale, y - 156 * scale);
  g.lineStyle(5 * scale, THEME.outline, 1);
  g.strokeTriangle(x + 62 * scale, y - 106 * scale, x + 96 * scale, y - 106 * scale, x + 92 * scale, y - 156 * scale);
  circle(g, x + 100 * scale, y - 164 * scale, 20 * scale, body, THEME.outline, 5 * scale);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + 108 * scale, y - 168 * scale, 3.6 * scale);
  // 角
  g.lineStyle(7 * scale, THEME.woodDeep, 1);
  g.lineBetween(x + 96 * scale, y - 182 * scale, x + 78 * scale, y - 226 * scale);
  g.lineBetween(x + 96 * scale, y - 182 * scale, x + 118 * scale, y - 222 * scale);
}

/** 分幕插图：① 满朝的人对着一头鹿 ② 关键的那一根已经换好了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.sky, 1.02), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  // 殿顶
  g.fillStyle(shade(THEME.tealDeep, 0.9), 1);
  g.fillTriangle(x - 20, y + h * 0.3, x + w + 20, y + h * 0.3, x + w / 2, y + h * 0.06);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 20, y + h * 0.3, x + w + 20, y + h * 0.3, x + w / 2, y + h * 0.06);
  // 台基
  g.fillStyle(STONE, 1);
  g.fillRect(x, y + h * 0.62, w, h * 0.38);
  g.lineStyle(5, THEME.outline, 0.8);
  g.lineBetween(x, y + h * 0.62, x + w, y + h * 0.62);

  if (index === 0) {
    // 满朝的人：一排简笔（有的低头，有的张嘴说"马"）
    for (let i = 0; i < 6; i += 1) {
      drawCourtier(g, x + w * (0.12 + i * 0.15), y + h * 0.86, 0.86, ROBE);
    }
    drawDeer(g, x + w * 0.22, y + h * 0.66, 0.9);
    // 一只手指着鹿
    g.lineStyle(9, SKIN, 1);
    g.lineBetween(x + w * 0.42, y + h * 0.5, x + w * 0.33, y + h * 0.44);
    return;
  }

  // ② 一排柱子：中间那根刚换成新的（金的箍、亮一点）
  const count = 4;
  for (let i = 0; i < count; i += 1) {
    const px = x + w * (0.16 + i * 0.23);
    const top = y + h * 0.3;
    const foot = y + h * 0.92;
    const fresh = i === 2;
    g.fillStyle(fresh ? LACQUER_FRESH : LACQUER, 1);
    g.fillRect(px - 22, top, 44, foot - top);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRect(px - 22, top, 44, foot - top);
    g.fillStyle(fresh ? GOLD_BAND : shade(THEME.goldDeep, 0.9), 1);
    g.fillRect(px - 22, top + 12, 44, 9);
    g.fillRect(px - 22, foot - 20, 44, 8);
    patternPanel(g, px, (top + foot) / 2, 30, 54, ['dragon', 'cloud', 'wave', 'flame'][i]!, false, 0.36);
    if (!fresh) continue;
    g.lineStyle(8, THEME.gold, 0.85);
    g.strokeCircle(px, (top + foot) / 2, 46);
  }
}
