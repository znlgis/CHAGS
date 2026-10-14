import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import type { TapStageMetrics, TraceLevel, TraceStageMetrics } from '@chags/templates';

const W = 750;
const H = 1334;

const SKIN = 0xf6d3ae;
const HAIR = 0x3a2f26;
const ROBE = 0x6fa86a;
const STRAW = 0xdcb26a;
const FIELD = 0xbfe3a4;
const SOIL = 0xb08748;
const GORGE = 0x6f6355;
const ROCK = 0xaeaaa2;

/** 划出来的河道长什么样（模板照着这个描一笔） */
export const CHANNEL_STROKE = { outer: THEME.water, inner: 0xa8dcf0, width: 46 } as const;

/** tap 段（堵）的舞台：左边是水，中间是我们一筐一筐堆起来的堤，右边是还没淹到的田 */
const DIKE = {
  /** 水面：第 0 下在 900，点满才涨到 620 —— 涨得比堤慢一点点 */
  waterStart: 900,
  waterEnd: 620,
  /** 堤顶：第 0 下在 862，点满到 560 */
  crestStart: 862,
  crestEnd: 560,
  /** 堤身：越堆越厚 */
  wallThin: 104,
  wallThick: 152,
  wallCx: 366,
} as const;

/** trace 段（疏）的世界：决口 → 盆地 → 龙门山山口 → 大海，一条线从上往下 */
const WORLD = {
  /** 决口两边剩下的残堤 */
  stubTop: 402,
  stubBottom: 508,
  /** 盆地里的洪水：水面从 560 退到 772 */
  floodTop: 560,
  floodDry: 772,
  /** 盆地底 = 龙门山的山脊 */
  mountainTop: 780,
  /** 山脚与海滩 */
  mountainBottom: 1064,
  /** 山口（没劈开之前只是一道细缝） */
  crackHalf: 32,
  /** 大海 */
  seaTop: 1100,
} as const;

type Point = readonly [number, number];

// ---------- 通用画笔 ----------

function poly(
  g: Phaser.GameObjects.Graphics,
  color: number,
  pts: Point[],
  outline: number = THEME.outline,
  width = 6,
): void {
  g.fillStyle(color, 1);
  g.beginPath();
  pts.forEach(([x, y], index) => {
    if (index === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.closePath();
  g.fillPath();
  if (outline > 0 && width > 0) {
    g.lineStyle(width, outline, 1);
    g.strokePath();
  }
}

/** 一道水：上面是会动的水波，一直铺到 bottom */
function waterShape(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  x1: number,
  bottom: number,
  topY: number,
  phase: number,
  color: number = THEME.water,
  alpha = 1,
): void {
  const amp = Math.min(10, Math.abs(x1 - x0) * 0.035);
  const steps = 22;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x0, topY);
  for (let i = 0; i <= steps; i += 1) {
    const px = x0 + ((x1 - x0) * i) / steps;
    g.lineTo(px, topY + Math.sin((i / steps) * Math.PI * 3 + phase) * amp);
  }
  g.lineTo(x1, bottom);
  g.lineTo(x0, bottom);
  g.closePath();
  g.fillPath();

  g.lineStyle(5, THEME.skyDeep, 0.8 * alpha);
  g.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const px = x0 + ((x1 - x0) * i) / steps;
    const py = topY + Math.sin((i / steps) * Math.PI * 3 + phase) * amp;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

function sun(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.lineStyle(6, THEME.goldDeep, 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(
      x + Math.cos(a) * (r + 10),
      y + Math.sin(a) * (r + 10),
      x + Math.cos(a) * (r + 30),
      y + Math.sin(a) * (r + 30),
    );
  }
  circle(g, x, y, r, THEME.gold, THEME.goldDeep, 6);
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(THEME.card, 0.95);
  g.fillCircle(x, y, 32 * s);
  g.fillCircle(x + 40 * s, y - 14 * s, 40 * s);
  g.fillCircle(x + 84 * s, y + 2 * s, 28 * s);
  g.fillStyle(THEME.card, 1);
  g.fillRoundedRect(x - 22 * s, y + 2 * s, 118 * s, 30 * s, 15 * s);
}

function rainCloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(0x8fa6b4, 1);
  g.fillCircle(x, y, 34 * s);
  g.fillCircle(x + 44 * s, y - 16 * s, 44 * s);
  g.fillCircle(x + 92 * s, y + 2 * s, 30 * s);
  g.fillRoundedRect(x - 22 * s, y + 2 * s, 128 * s, 34 * s, 17 * s);
  g.lineStyle(5, THEME.water, 0.9);
  for (let i = 0; i < 5; i += 1) {
    const rx = x - 6 * s + i * 28 * s;
    g.lineBetween(rx, y + 44 * s, rx - 12 * s, y + 96 * s);
  }
}

function mountain(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w: number, h: number, color: number): void {
  poly(g, color, [[cx - w / 2, baseY], [cx, baseY - h], [cx + w / 2, baseY]], THEME.outline, 6);
  poly(g, shade(color, 0.92), [[cx, baseY - h], [cx + w * 0.22, baseY - h * 0.35], [cx, baseY - h * 0.45]], 0, 0);
}

function hill(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, rx: number, ry: number, color = FIELD): void {
  const pts: Point[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i += 1) {
    const a = Math.PI * (i / steps);
    pts.push([cx - Math.cos(a) * rx, baseY - Math.sin(a) * ry]);
  }
  poly(g, color, pts, THEME.outline, 7);
}

function fieldRows(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, rows: number): void {
  for (let i = 0; i < rows; i += 1) {
    roundRect(g, x, y + i * 42, w, 26, 13, SOIL, shade(SOIL, 0.78), 4);
  }
}

function sprout(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.lineStyle(6 * s, 0x4f8f45, 1);
  g.lineBetween(x, y, x, y - 30 * s);
  g.fillStyle(THEME.leaf, 1);
  g.fillEllipse(x - 13 * s, y - 30 * s, 32 * s, 18 * s);
  g.fillEllipse(x + 13 * s, y - 22 * s, 32 * s, 18 * s);
  g.lineStyle(4 * s, THEME.outline, 1);
  g.strokeEllipse(x - 13 * s, y - 30 * s, 32 * s, 18 * s);
}

function house(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, lit: number): void {
  if (lit > 0.5) {
    // 窗里亮着灯：先铺一层暖光
    g.fillStyle(0xffd98a, 0.28 * lit);
    g.fillCircle(x + 56 * s, y + 22 * s, 90 * s * lit);
  }
  roundRect(g, x - 92 * s, y - 44 * s, 184 * s, 124 * s, 14 * s, 0xf0dcb4, THEME.outline, 5 * s);
  poly(g, STRAW, [[x - 118 * s, y - 32 * s], [x, y - 120 * s], [x + 118 * s, y - 32 * s]], THEME.outline, 5 * s);
  g.fillStyle(THEME.woodDeep, 1);
  g.fillRoundedRect(x - 26 * s, y + 6 * s, 52 * s, 74 * s, { tl: 22 * s, tr: 22 * s, bl: 4 * s, br: 4 * s });
  g.lineStyle(4 * s, THEME.outline, 1);
  g.strokeRoundedRect(x - 26 * s, y + 6 * s, 52 * s, 74 * s, { tl: 22 * s, tr: 22 * s, bl: 4 * s, br: 4 * s });
  const pane = lit > 0.5 ? 0xffd98a : 0xc9b79b;
  roundRect(g, x + 32 * s, y - 6 * s, 48 * s, 46 * s, 8 * s, pane, THEME.outline, 4 * s);
  if (lit > 0.5) {
    g.fillStyle(shade(0xffd98a, 0.55), 1);
    g.fillEllipse(x + 54 * s, y + 34 * s, 30 * s, 24 * s);
    g.fillCircle(x + 50 * s, y + 14 * s, 10 * s);
    g.fillCircle(x + 68 * s, y + 22 * s, 8 * s);
  }
}

function villager(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, robe: number): void {
  groundShadow(g, x, y + 4 * s, 46 * s, 14 * s);
  g.lineStyle(11 * s, shade(robe, 0.7), 1);
  g.lineBetween(x - 8 * s, y - 34 * s, x - 10 * s, y);
  g.lineBetween(x + 8 * s, y - 34 * s, x + 10 * s, y);
  roundRect(g, x - 22 * s, y - 96 * s, 44 * s, 68 * s, 18 * s, robe, THEME.outline, 5 * s);
  circle(g, x, y - 112 * s, 22 * s, SKIN, THEME.outline, 5 * s);
  g.fillStyle(HAIR, 1);
  g.fillRoundedRect(x - 22 * s, y - 134 * s, 44 * s, 22 * s, 9 * s);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 7 * s, y - 112 * s, 3.4 * s);
  g.fillCircle(x + 7 * s, y - 112 * s, 3.4 * s);
}

/** 大禹：斗笠、蓑衣、手里的耒；step 是走路的相位 */
function yuFigure(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, step: number): void {
  const swing = Math.sin(step * Math.PI * 2) * 13 * s;
  groundShadow(g, x, y + 4 * s, 62 * s, 16 * s);
  g.lineStyle(13 * s, shade(ROBE, 0.7), 1);
  g.lineBetween(x - 10 * s, y - 34 * s, x - 10 * s + swing, y);
  g.lineBetween(x + 10 * s, y - 34 * s, x + 10 * s - swing, y);
  poly(g, STRAW, [[x - 36 * s, y - 40 * s], [x + 36 * s, y - 40 * s], [x + 28 * s, y - 122 * s], [x - 28 * s, y - 122 * s]], THEME.outline, 5 * s);
  circle(g, x, y - 144 * s, 25 * s, SKIN, THEME.outline, 5 * s);
  poly(g, STRAW, [[x - 48 * s, y - 156 * s], [x, y - 202 * s], [x + 48 * s, y - 156 * s]], THEME.outline, 5 * s);
  // 耒：握在身前，斜插到地上
  g.lineStyle(11 * s, THEME.woodDeep, 1);
  g.lineBetween(x + 34 * s, y - 116 * s, x + 58 * s, y - 2 * s);
  g.lineStyle(9 * s, THEME.woodDeep, 1);
  g.lineBetween(x + 44 * s, y - 44 * s, x + 70 * s, y - 30 * s);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + 9 * s, y - 146 * s, 3.6 * s);
  g.lineStyle(4 * s, THEME.outline, 1);
  g.lineBetween(x + 2 * s, y - 132 * s, x + 18 * s, y - 132 * s);
}

function basket(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.lineStyle(6 * s, THEME.woodDeep, 1);
  g.beginPath();
  g.moveTo(x - 22 * s, y - 16 * s);
  g.lineTo(x - 8 * s, y - 44 * s);
  g.lineTo(x + 8 * s, y - 44 * s);
  g.lineTo(x + 22 * s, y - 16 * s);
  g.strokePath();
  roundRect(g, x - 32 * s, y - 20 * s, 64 * s, 48 * s, { tl: 8 * s, tr: 8 * s, bl: 20 * s, br: 20 * s }, STRAW, THEME.woodDeep, 5 * s);
  g.lineStyle(4 * s, THEME.woodDeep, 1);
  g.lineBetween(x - 24 * s, y - 4 * s, x + 24 * s, y - 4 * s);
  g.lineBetween(x - 22 * s, y + 12 * s, x + 22 * s, y + 12 * s);
  g.fillStyle(SOIL, 1);
  g.fillEllipse(x, y - 22 * s, 56 * s, 16 * s);
}

function rock(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  poly(g, ROCK, [[x - 34 * s, y], [x - 16 * s, y - 30 * s], [x + 12 * s, y - 24 * s], [x + 34 * s, y]], THEME.outline, 5 * s);
}

// ---------- tap 段：一筐一筐筑堤 ----------

function dikeWall(g: Phaser.GameObjects.Graphics, crestY: number, half: number): void {
  const x0 = DIKE.wallCx - half;
  const w = half * 2;
  const bottom = H + 40;
  roundRect(g, x0, crestY, w, bottom - crestY, { tl: 22, tr: 22, bl: 0, br: 0 }, SOIL, THEME.outline, 7);
  // 一筐一筐堆上去的层
  g.lineStyle(4, shade(SOIL, 0.76), 0.9);
  for (let y = crestY + 44; y < bottom - 60; y += 46) {
    g.lineBetween(x0 + 10, y, x0 + w - 10, y);
  }
  g.lineStyle(4, shade(SOIL, 1.14), 0.7);
  for (let y = crestY + 66; y < bottom - 60; y += 92) {
    g.lineBetween(x0 + 10, y, x0 + w - 10, y);
  }
  // 堤顶的草皮
  roundRect(g, x0 - 8, crestY - 18, w + 16, 32, 16, THEME.leaf, THEME.outline, 6);
  for (let i = 0; i < 3; i += 1) {
    const gx = x0 + 18 + i * (w - 36) / 2;
    g.lineStyle(5, shade(THEME.leaf, 0.8), 1);
    g.lineBetween(gx, crestY - 16, gx - 6, crestY - 34);
    g.lineBetween(gx + 6, crestY - 16, gx + 10, crestY - 32);
  }
}

/** 每帧重画：堤越筑越高，水也越涨越高 —— 但水位总是差堤顶一点点 */
export function drawDikeStage(g: Phaser.GameObjects.Graphics, stage: TapStageMetrics): void {
  const p = stage.eased;
  const waterY = DIKE.waterStart + (DIKE.waterEnd - DIKE.waterStart) * p;
  const crestY = DIKE.crestStart + (DIKE.crestEnd - DIKE.crestStart) * p;
  const half = (DIKE.wallThin + (DIKE.wallThick - DIKE.wallThin) * p) / 2;
  const wallRight = DIKE.wallCx + half;
  const phase = stage.progress * 26;

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, W, H - 150);
  sun(g, 626, 250, 42);
  cloud(g, 120, 236, 0.85);
  cloud(g, 476, 330, 0.6);

  // 远处的山：水一涨就淹掉半截，孩子一眼看出水在涨
  mountain(g, 90, 1010, 300, 300, 0xa8d6c0);
  mountain(g, 250, 1010, 220, 232, 0x9fd0b8);

  // 右边：还没被淹到的田与村庄
  g.fillStyle(FIELD, 1);
  g.fillRect(wallRight - 40, 560, W - wallRight + 40, H - 560);
  hill(g, 596, 700, 200, 168);
  house(g, 566, 546, 0.62, 0);
  house(g, 664, 592, 0.5, 0);
  villager(g, 546, 528, 0.9, THEME.teal);
  villager(g, 626, 546, 0.82, THEME.red);
  fieldRows(g, 470, 760, 250, 4);

  // 左边：洪水
  waterShape(g, -20, wallRight + 24, H + 40, waterY, phase);

  // 堤：我们一筐一筐堆起来的土墙
  dikeWall(g, crestY, half);
  basket(g, DIKE.wallCx + half + 6, crestY + 30, 0.9);
  // 鲧还站在堤上往下倒土
  villager(g, DIKE.wallCx - 44, crestY - 20, 0.95, THEME.teal);
}

/** 决口：水漫过堤顶，堤塌开一道口子，水冲回田里 */
export function drawBreach(g: Phaser.GameObjects.Graphics, stage: TapStageMetrics): void {
  drawDikeStage(g, stage);
  const crestY = DIKE.crestEnd;
  const x0 = DIKE.wallCx - 62;
  const x1 = DIKE.wallCx + 62;
  const gapTop = crestY - 4;
  const gapBottom = crestY + 216;

  // ① 豁口：堤顶被水冲掉一块，水从这儿漫出去
  poly(
    g,
    THEME.water,
    [
      [x0 - 8, gapTop],
      [x1 + 8, gapTop],
      [x1 - 16, gapBottom],
      [x0 + 16, gapBottom],
    ],
    THEME.outline,
    6,
  );
  // ② 冲出去的水：从豁口往右边的田里铺开
  waterShape(g, x1 - 24, W + 20, H + 40, gapBottom - 30, 1.3);
  waterShape(g, x1 - 70, W + 20, H + 40, gapBottom + 118, 0.45);
  g.fillStyle(THEME.card, 0.85);
  for (const [sx, sy, sr] of [[x1 + 30, gapBottom - 26, 18], [x1 + 96, gapBottom + 6, 14], [DIKE.wallCx, gapBottom - 10, 16]] as const) {
    g.fillCircle(sx, sy, sr);
  }
  // ③ 塌下来的土块：贴着豁口的两沿，不悬空
  poly(g, shade(SOIL, 0.86), [[x0 - 78, gapTop - 22], [x0 - 6, gapTop + 8], [x0 - 22, gapTop + 96], [x0 - 86, gapTop + 52]], THEME.outline, 6);
  poly(g, shade(SOIL, 1.08), [[x1 + 6, gapTop, ], [x1 + 66, gapTop - 26], [x1 + 74, gapTop + 60], [x1 + 22, gapTop + 74]], THEME.outline, 6);
  // ④ 被水冲走的筐与石头
  basket(g, x1 + 190, gapBottom + 120, 0.85);
  basket(g, x1 + 300, gapBottom + 240, 0.7);
  rock(g, x1 + 120, gapBottom + 190, 0.9);
  // ⑤ 人们在高地上看着水冲回田里
  villager(g, 546, 528, 0.95, THEME.red);
  villager(g, 626, 546, 0.88, THEME.teal);
}

// ---------- trace 段：水退下去，路通到大海 ----------

function bankStub(g: Phaser.GameObjects.Graphics, x0: number, x1: number, jaggedRight: boolean): void {
  const pts: Point[] = jaggedRight
    ? [[x0, WORLD.stubTop], [x1 - 26, WORLD.stubTop], [x1 - 4, WORLD.stubTop + 40], [x1 - 30, WORLD.stubBottom], [x0, WORLD.stubBottom]]
    : [[x0 + 26, WORLD.stubTop], [x1, WORLD.stubTop], [x1, WORLD.stubBottom], [x0 + 30, WORLD.stubBottom], [x0 + 4, WORLD.stubTop + 44]];
  poly(g, SOIL, pts, THEME.outline, 7);
  roundRect(g, x0 + 8, WORLD.stubTop - 14, x1 - x0 - 16, 30, 15, THEME.leaf, THEME.outline, 6);
}

/** 世界是静的：山、村庄、田地、残堤画一次就够了 */
export function drawTraceWorld(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(1);

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, W, H - 150);
  sun(g, 628, 250, 42);
  cloud(g, 116, 232, 0.85);
  cloud(g, 492, 318, 0.6);

  // 决口上面的水：从画面上方一路灌下来
  waterShape(g, 186, 566, 470, 150, 0.4);
  waterShape(g, -20, W + 20, 470, 404, 1.1, shade(THEME.water, 0.92));
  // 决口两边剩下的两截残堤
  bankStub(g, -40, 322, true);
  bankStub(g, 430, 790, false);

  // 盆地：村庄的小山 + 田垄
  g.fillStyle(FIELD, 1);
  g.fillRect(-20, WORLD.stubBottom - 46, W + 40, WORLD.mountainTop - WORLD.stubBottom + 46);
  hill(g, 140, 792, 236, 268);
  house(g, 92, 556, 0.62, 0);
  house(g, 218, 598, 0.5, 0);
  villager(g, 156, 552, 0.86, THEME.teal);
  villager(g, 214, 574, 0.8, THEME.red);
  fieldRows(g, 336, 612, 396, 4);

  // 龙门山：两块大石头，中间只裂着一道细缝
  g.fillStyle(GORGE, 1);
  g.fillRect(-20, WORLD.mountainTop, W + 40, WORLD.mountainBottom - WORLD.mountainTop);
  poly(
    g,
    ROCK,
    [[-60, WORLD.mountainBottom + 20], [30, 968], [128, 862], [206, 900], [276, 812], [343, WORLD.mountainBottom + 20]],
    THEME.outline,
    7,
  );
  poly(
    g,
    shade(ROCK, 0.9),
    [[407, WORLD.mountainBottom + 20], [470, 900], [552, 826], [628, 890], [712, 950], [810, WORLD.mountainBottom + 20]],
    THEME.outline,
    7,
  );
  poly(g, shade(ROCK, 1.06), [[128, 862], [206, 900], [276, 812], [266, 880], [190, 946], [140, 900]], 0, 0);
  // 山口：两块石头之间塞满碎石，水得从这儿凿出一条路
  poly(g, SOIL, [[343, WORLD.mountainBottom + 20], [375, WORLD.mountainTop - 4], [407, WORLD.mountainBottom + 20]], THEME.outline, 6);
  rock(g, 362, WORLD.mountainTop + 60, 0.7);
  rock(g, 392, WORLD.mountainTop + 150, 0.6);

  // 山脚的沙滩与礁石
  g.fillStyle(THEME.sand, 1);
  g.fillRect(-20, WORLD.mountainBottom, W + 40, WORLD.seaTop - WORLD.mountainBottom);
  rock(g, 110, 1092, 1.1);
  rock(g, 636, 1086, 0.9);
  rock(g, 296, 1096, 0.7);
}

/** 山口被劈开：越划越宽，最后裂成一道峡谷 */
function splitPass(g: Phaser.GameObjects.Graphics, stage: TraceStageMetrics, done: number): void {
  const cut = done >= 2 ? 1 : stage.segment > 1 ? 1 : stage.segment === 1 ? stage.anchor / 3 : 0;
  if (cut <= 0) return;
  const half = WORLD.crackHalf + 30 * cut;
  const yTop = WORLD.mountainTop;
  const yBottom = WORLD.mountainBottom + 24;
  const teeth = 7;
  const pts: Point[] = [];
  for (let i = 0; i <= teeth; i += 1) {
    const y = yTop + ((yBottom - yTop) * i) / teeth;
    pts.push([375 - half - (i % 2 === 0 ? 0 : 10), y]);
  }
  for (let i = teeth; i >= 0; i -= 1) {
    const y = yTop + ((yBottom - yTop) * i) / teeth;
    pts.push([375 + half + (i % 2 === 0 ? 0 : 10), y]);
  }
  poly(g, GORGE, pts, THEME.outline, 5);
}

/** 每帧重画：水位按进度往下退，露出来的土地冒绿苗，水顺着划出来的河道流 */
export function drawFloodStage(
  g: Phaser.GameObjects.Graphics,
  stage: TraceStageMetrics,
  state: { done: number; now: number },
  cutscene: { nth: number; p: number } | null = null,
): void {
  const drain = Math.min(1, Math.max(stage.progress, state.done / 3));
  const waterTop = WORLD.floodTop + (WORLD.floodDry - WORLD.floodTop) * drain;
  const phase = state.now / 300;

  // 决口还在往下灌水
  const fallBottom = Math.min(waterTop + 26, WORLD.mountainTop);
  g.fillStyle(THEME.water, 0.5);
  g.fillRect(322, WORLD.stubBottom - 26, 106, Math.max(60, fallBottom - WORLD.stubBottom + 26));
  g.fillStyle(THEME.card, 0.7);
  g.fillCircle(340 + Math.sin(phase * 2) * 12, fallBottom + 4, 13);
  g.fillCircle(412 - Math.sin(phase * 2) * 12, fallBottom - 2, 11);

  // 盆地里的洪水
  waterShape(g, -20, W + 20, WORLD.mountainTop + 16, waterTop, phase);

  // 山被劈开：划到哪儿裂到哪儿
  splitPass(g, stage, state.done);

  // 水从山口流下去，再进大海
  if (drain > 0.04) {
    const half = 22 + drain * 18;
    g.fillStyle(THEME.water, 0.95);
    g.fillRect(375 - half, WORLD.mountainTop - 6, half * 2, H + 40 - WORLD.mountainTop);
    g.lineStyle(5, THEME.skyDeep, 0.7);
    for (let i = 0; i < 7; i += 1) {
      const y = WORLD.mountainTop + 34 + i * 62;
      const off = Math.sin(phase * 1.6 + i) * 10;
      g.lineBetween(375 - half + 8 + off, y, 375 + half - 8 + off, y);
    }
  }

  // 大海
  waterShape(g, -20, W + 20, H + 40, WORLD.seaTop, phase * 0.6, THEME.waterDeep);
  g.lineStyle(6, THEME.card, 0.55);
  for (let i = 0; i < 4; i += 1) {
    const y = WORLD.seaTop + 40 + i * 62;
    const off = Math.sin(phase * 1.3 + i) * 24;
    for (let k = 0; k < 4; k += 1) {
      const x = 78 + k * 190 + off;
      g.lineBetween(x - 28, y, x + 28, y);
    }
  }

  // 水退下去的地方，土地长出绿苗（要真退到垄下面，苗才站得住）
  [612, 654, 696, 738].forEach((y, row) => {
    const dry = waterTop - (y + 30);
    if (dry <= 0) return;
    const grow = Math.min(1, dry / 40);
    for (let i = 0; i < 7; i += 1) {
      sprout(g, 354 + i * 56 + (row % 2) * 24, y + 22, 0.55 + grow * 0.5);
    }
  });

  // 水顺着划出来的河道流
  if (stage.path.length > 1) {
    const gap = 54;
    const offset = (state.now / 5) % gap;
    let travelled = 0;
    for (let i = 1; i < stage.path.length; i += 1) {
      const a = stage.path[i - 1]!;
      const b = stage.path[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.5) continue;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      for (let d = gap - ((travelled + offset) % gap); d <= len; d += gap) {
        g.fillStyle(THEME.card, 0.75);
        g.fillCircle(a.x + ux * d, a.y + uy * d, 8);
        g.fillStyle(THEME.water, 0.9);
        g.fillCircle(a.x + ux * d - ux * 14, a.y + uy * d - uy * 14, 5);
      }
      travelled += len;
    }
    const head = stage.path[stage.path.length - 1]!;
    g.fillStyle(THEME.card, 0.85);
    g.fillCircle(head.x, head.y, 14);
    g.fillStyle(THEME.skyDeep, 1);
    g.fillCircle(head.x, head.y, 7);
  }

  // 三过家门：这一段结束时路过一次家门口
  if (cutscene) drawWalkHome(g, cutscene.nth, cutscene.p);
}

function strokeRoute(g: Phaser.GameObjects.Graphics, route: Point[]): void {
  g.beginPath();
  route.forEach(([x, y], index) => {
    if (index === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.strokePath();
}

/** 收尾：水落石出，一条大河通到大海，田里长满了苗，山上的人走下来 */
export function drawTraceFinale(g: Phaser.GameObjects.Graphics, level: TraceLevel): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(W / 2, 720, 460);

  const route: Point[] = [];
  for (const segment of level.segments) {
    route.push([segment.start.x, segment.start.y]);
    for (const anchor of segment.anchors) route.push([anchor.x, anchor.y]);
    route.push([segment.end.x, segment.end.y]);
  }
  g.lineStyle(CHANNEL_STROKE.width + 14, THEME.outline, 0.55);
  strokeRoute(g, route);
  g.lineStyle(CHANNEL_STROKE.width, 0x8a6a2f, 1);
  strokeRoute(g, route);
  g.lineStyle(CHANNEL_STROKE.width * 0.5, THEME.water, 1);
  strokeRoute(g, route);

  [612, 654, 696, 738].forEach((y, row) => {
    for (let i = 0; i < 7; i += 1) {
      sprout(g, 354 + i * 56 + (row % 2) * 24, y + 20, 0.95);
    }
  });
  yuFigure(g, 596, 764, 0.9, 0.5);
  villager(g, 150, 748, 0.95, THEME.teal);
  villager(g, 220, 764, 0.9, THEME.red);
  sun(g, 628, 250, 42);
}

// ---------- 三过家门 ----------

function walkX(p: number): number {
  if (p < 0.45) return 690 + (250 - 690) * (p / 0.45);
  if (p < 0.72) return 250 - 20 * ((p - 0.45) / 0.27);
  return 230 + (92 - 230) * ((p - 0.72) / 0.28);
}

/**
 * 划完一段，路过一次家门口：窗里亮着灯，他都没有进去。
 * 三次路过就在门前的木桩上刻三道 —— 不点也不影响，1.5 秒后自己走。
 *
 * 画在模板每帧都会重画的舞台上（这里只负责"此刻长什么样"，时间由调用方给）。
 */
export function drawWalkHome(g: Phaser.GameObjects.Graphics, nth: number, p: number): void {
  g.fillStyle(THEME.outline, 0.24);
  g.fillRect(0, 150, W, H - 150);

  const x = walkX(p);
  const near = Math.max(0, 1 - Math.abs(x - 250) / 160);
  house(g, 250, 720, 1.05, 0.66 + near * 0.34);

  // 门前的木桩：路过一次，刻一道
  g.lineStyle(10, THEME.woodDeep, 1);
  g.lineBetween(392, 736, 392, 660);
  g.lineStyle(6, THEME.outline, 1);
  for (let i = 0; i < nth; i += 1) {
    g.lineBetween(378, 672 + i * 22, 406, 666 + i * 22);
  }

  yuFigure(g, x, 768, 0.92, (p * 3) % 1);
}

// ---------- 分幕插图 ----------

export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);

  if (index === 0) {
    // 洪水来了：乌云下着雨，田地淹在水里，人们躲到山上
    rainCloud(g, x + 130, y + 96, 1);
    rainCloud(g, x + 400, y + 70, 0.8);
    hill(g, x + 470, y + h * 0.56, 226, 214);
    house(g, x + 430, y + h * 0.56 - 92, 0.62, 0);
    villager(g, x + 556, y + h * 0.56 - 118, 0.9, THEME.teal);
    villager(g, x + 126, y + h * 0.56 - 118, 0.85, THEME.red);
    waterShape(g, x - 10, x + w + 10, y + h + 10, y + h * 0.52, 0.6);
    // 淹在水里的田垄与几株还没倒的苗
    g.lineStyle(5, shade(SOIL, 0.7), 0.7);
    for (let i = 0; i < 4; i += 1) {
      g.lineBetween(x + 40, y + h * 0.68 + i * 46, x + w - 60, y + h * 0.68 + i * 46);
    }
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 76 + i * 96;
      g.lineStyle(7, 0x4f8f45, 1);
      g.lineBetween(sx, y + h * 0.66, sx - 10, y + h * 0.66 - 54);
      g.fillStyle(THEME.leaf, 1);
      g.fillEllipse(sx - 16, y + h * 0.66 - 54, 36, 20);
    }
    return;
  }

  // 给水一条路：左边鲧用土堵，右边禹开出一条通往大海的河道
  sun(g, x + w - 86, y + 84, 36);
  g.fillStyle(FIELD, 1);
  g.fillRect(x + 250, y + 210, w - 250, h - 210);
  waterShape(g, x - 10, x + 246, y + h + 10, y + 176, 0.3);
  roundRect(g, x + 196, y + 132, 124, h - 132 + 10, { tl: 22, tr: 22, bl: 0, br: 0 }, SOIL, THEME.outline, 7);
  g.lineStyle(4, shade(SOIL, 0.76), 0.9);
  for (let i = 1; i < 9; i += 1) {
    g.lineBetween(x + 206, y + 132 + i * 62, x + 310, y + 132 + i * 62);
  }
  roundRect(g, x + 188, y + 118, 140, 28, 14, THEME.leaf, THEME.outline, 6);
  villager(g, x + 258, y + 116, 0.95, THEME.teal);
  basket(g, x + 322, y + 96, 0.8);

  // 河道：从堤的豁口一路划到海里
  g.lineStyle(34, THEME.water, 1);
  g.beginPath();
  g.moveTo(x + 322, y + 168);
  g.lineTo(x + 396, y + 300);
  g.lineTo(x + 402, y + 424);
  g.lineTo(x + 520, y + 524);
  g.strokePath();
  g.lineStyle(8, THEME.skyDeep, 0.7);
  g.beginPath();
  g.moveTo(x + 322, y + 168);
  g.lineTo(x + 396, y + 300);
  g.lineTo(x + 402, y + 424);
  g.lineTo(x + 520, y + 524);
  g.strokePath();
  waterShape(g, x + 250, x + w + 10, y + h + 10, y + h - 104, 0.9, THEME.waterDeep);
  yuFigure(g, x + 466, y + 470, 1, 0);
  fieldRows(g, x + 448, y + 300, 150, 2);
}
