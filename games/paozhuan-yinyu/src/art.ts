import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { LureStageState } from '@chags/templates';
import type { LureLevel, LureOffer } from '@chags/templates/schemas';
import {
  JADE_BAR, OFFER_RADIUS, PARTNER, RETURN_AT, RETURN_COLUMN_X, TABLE_LEFT, TABLE_RIGHT, TABLE_Y,
  VERSE_XS, WALL_BOTTOM, WALL_LEFT, WALL_RIGHT, WALL_TOP,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

const WALL = 0xf3e6c8;
const WALL_DEEP = 0xe2cfa6;
const FRAME = 0x8b5e34;
const FLOOR = 0xc9a06a;
const INK = 0x3a2f26;
const JADE = 0x4fa08b;

// ---------------- 小零件 ----------------

/** 一列诗句：几个字，从上往下排 */
function drawColumn(
  g: Phaser.GameObjects.Graphics,
  x: number,
  top: number,
  count: number,
  size: number,
  faint = false,
): void {
  for (let i = 0; i < count; i += 1) {
    const cy = top + i * size;
    const alpha = faint ? 0.35 : 1;
    g.lineStyle(9, INK, alpha);
    g.lineBetween(x - size * 0.3, cy, x + size * 0.3, cy);
    g.lineBetween(x, cy - size * 0.3, x, cy + size * 0.3);
    if (i % 2 === 0) g.lineBetween(x - size * 0.22, cy + size * 0.24, x + size * 0.22, cy + size * 0.24);
  }
}

/** 一张诗笺（换回来的东西）：字数越多、越大、越亮 */
function drawSlip(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  lines: number,
  glow: number,
): void {
  const w = 170 * s;
  const h = 210 * s;
  if (glow > 0) {
    g.fillStyle(glow >= 1 ? THEME.gold : JADE, 0.14 + 0.16 * Math.min(1, glow));
    g.fillEllipse(x, y, w * 2.4, h * 1.5);
  }
  roundRect(g, x - w / 2, y - h / 2, w, h, 14 * s, THEME.paper, THEME.outline, 6 * s);
  for (let i = 0; i < lines; i += 1) {
    const ly = y - h * 0.32 + i * (h * 0.62) / Math.max(1, lines - 1 === 0 ? 1 : lines - 1);
    g.lineStyle(8 * s, INK, 0.85);
    g.lineBetween(x - w * 0.3, ly, x + w * 0.3, ly);
    if (i % 2 === 1) g.lineBetween(x - w * 0.2, ly + 8 * s, x + w * 0.2, ly + 8 * s);
  }
  if (glow >= 1) {
    // 换到玉了：一枚小小的玉坠
    circle(g, x + w * 0.42, y + h * 0.44, 20 * s, JADE, THEME.outline, 5 * s);
  }
}

/** 三样东西：纸 / 墨 / 笔（怎么画由 kind 决定） */
function drawOffer(
  g: Phaser.GameObjects.Graphics,
  offer: LureOffer,
  given: boolean,
  holding: boolean,
): void {
  const { x, y } = offer;
  const s = given ? 0.9 : 1;
  const alpha = given ? 0.45 : 1;
  groundShadow(g, x, y + 44, 130 * s, 26 * s, 0.16 * alpha);
  if (offer.kind === 'paper') {
    // 一张纸：最不起眼的那一块砖
    g.fillStyle(THEME.paper, alpha);
    g.fillRect(x - 52 * s, y - 62 * s, 104 * s, 118 * s);
    g.lineStyle(6 * s, THEME.outline, alpha);
    g.strokeRect(x - 52 * s, y - 62 * s, 104 * s, 118 * s);
    g.lineStyle(5 * s, shade(INK, 1.6), 0.4 * alpha);
    for (let i = 0; i < 3; i += 1) {
      g.lineBetween(x - 34 * s, y - 34 * s + i * 26 * s, x + 34 * s, y - 34 * s + i * 26 * s);
    }
    return;
  }
  if (offer.kind === 'ink') {
    // 一方墨：黑亮的一小条
    roundRect(g, x - 30 * s, y - 58 * s, 60 * s, 112 * s, 10 * s, 0x2f2a25, THEME.outline, 6 * s, alpha);
    g.lineStyle(6 * s, THEME.goldDeep, alpha);
    g.strokeRect(x - 14 * s, y - 40 * s, 28 * s, 74 * s);
    return;
  }
  // 一支笔：笔杆 + 笔头（插在笔架上）
  g.lineStyle(14 * s, THEME.wood, alpha);
  g.lineBetween(x + 6 * s, y + 48 * s, x - 16 * s, y - 46 * s);
  g.fillStyle(THEME.outline, alpha);
  g.fillTriangle(
    x - 16 * s, y - 46 * s,
    x - 30 * s, y - 74 * s,
    x - 4 * s, y - 68 * s,
  );
  roundRect(g, x - 44 * s, y + 36 * s, 96 * s, 26 * s, 12 * s, THEME.stone, THEME.outline, 5 * s, alpha);
  if (holding) {
    g.lineStyle(7, THEME.gold, 0.9);
    g.strokeCircle(x, y, OFFER_RADIUS + 20);
  }
}

/** 那位过路人（文人）：站在案前，手里拿着一卷纸 */
function drawScholar(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, raised: boolean): void {
  const foot = y + 8 * s;
  groundShadow(g, x, foot, 150 * s, 34 * s, 0.18);
  // 长衫
  roundRect(g, x - 52 * s, foot - 190 * s, 104 * s, 196 * s, 30 * s, THEME.teal, THEME.outline, 6 * s);
  g.fillStyle(shade(THEME.teal, 0.86), 1);
  g.fillEllipse(x, foot - 96 * s, 104 * s, 54 * s);
  // 衣带
  g.lineStyle(9 * s, THEME.paper, 1);
  g.lineBetween(x - 44 * s, foot - 122 * s, x + 44 * s, foot - 122 * s);
  // 头
  circle(g, x, foot - 220 * s, 34 * s, 0xf8dcbb, THEME.outline, 6 * s);
  // 幞头（文人的帽子）
  roundRect(g, x - 34 * s, foot - 268 * s, 68 * s, 30 * s, 12 * s, INK, THEME.outline, 5 * s);
  // 眼睛
  g.fillStyle(INK, 1);
  g.fillCircle(x - 12 * s, foot - 222 * s, 4 * s);
  g.fillCircle(x + 12 * s, foot - 222 * s, 4 * s);
  // 袖子与手里的纸卷
  roundRect(g, x - 96 * s, foot - 168 * s, 52 * s, 40 * s, 18 * s, shade(THEME.teal, 1.08), THEME.outline, 5 * s);
  roundRect(g, x + 44 * s, foot - (raised ? 196 : 160) * s, 52 * s, 40 * s, 18 * s, shade(THEME.teal, 1.08), THEME.outline, 5 * s);
  const hx = x + 74 * s;
  const hy = foot - (raised ? 210 : 176) * s;
  g.fillStyle(THEME.paper, 1);
  g.fillRect(hx - 16 * s, hy - 26 * s, 32 * s, 52 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeRect(hx - 16 * s, hy - 26 * s, 32 * s, 52 * s);
}

// ---------------- 景 ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: LureLevel): void {
  // 地板与墙（标题条 0..150 留给 BaseScene）
  g.fillStyle(0x6b4a2a, 1);
  g.fillRect(0, 150, W, H - 150);
  g.fillStyle(FLOOR, 1);
  g.fillRect(0, 560, W, H - 560);
  g.lineStyle(5, shade(FLOOR, 0.82), 1);
  for (let y = 620; y < H; y += 96) g.lineBetween(0, y, W, y);

  // 题诗的墙：一块挂起来的纸
  roundRect(g, WALL_LEFT - 18, WALL_TOP - 18, WALL_RIGHT - WALL_LEFT + 36, WALL_BOTTOM - WALL_TOP + 36, 18, FRAME, THEME.outline, 7);
  roundRect(g, WALL_LEFT, WALL_TOP, WALL_RIGHT - WALL_LEFT, WALL_BOTTOM - WALL_TOP, 10, WALL, null, 0);
  g.lineStyle(5, WALL_DEEP, 1);
  for (let i = 1; i < 5; i += 1) {
    g.lineBetween(WALL_LEFT + 10, WALL_TOP + ((WALL_BOTTOM - WALL_TOP) * i) / 5, WALL_RIGHT - 10, WALL_TOP + ((WALL_BOTTOM - WALL_TOP) * i) / 5);
  }

  // 前两列：已经写好的那两句（第三列空着，等着好句）
  drawColumn(g, VERSE_XS[0]!, WALL_TOP + 62, 4, 74);
  drawColumn(g, VERSE_XS[1]!, WALL_TOP + 62, 4, 74);
  // 空着的那一列：一个淡淡的框，告诉孩子"这里还能写"
  g.lineStyle(5, shade(WALL_DEEP, 0.92), 0.9);
  g.strokeRect(RETURN_COLUMN_X - 46, WALL_TOP + 30, 92, (WALL_BOTTOM - WALL_TOP) - 60);

  // 案（矮几）：案面就在三样东西的脚下（它们站在案上，不是飘在案前）
  roundRect(g, TABLE_LEFT, TABLE_Y + 40, TABLE_RIGHT - TABLE_LEFT, 66, 20, FRAME, THEME.outline, 7);
  roundRect(g, TABLE_LEFT + 26, TABLE_Y + 106, 34, 168, 12, shade(FRAME, 0.86), THEME.outline, 6);
  roundRect(g, TABLE_RIGHT - 60, TABLE_Y + 106, 34, 168, 12, shade(FRAME, 0.86), THEME.outline, 6);
  // 案子上的席子
  wavyBand(g, TABLE_LEFT + 8, TABLE_Y + 52, TABLE_RIGHT - TABLE_LEFT - 16, 40, shade(THEME.paper, 0.98), 0.9, 6, 3);

  // 三样东西的席垫：位子按关卡数据摆 —— "这里摆得下三样东西"
  if (level.mode === 'trade') {
    for (const offer of level.offers) {
      g.fillStyle(shade(THEME.paper, 0.94), 0.9);
      g.fillEllipse(offer.x, offer.y + 40, 150, 40);
      g.lineStyle(5, shade(FRAME, 1.05), 0.5);
      g.strokeEllipse(offer.x, offer.y + 40, 150, 40);
    }
  }

  // 案边的兰草（书斋该有的那点绿）
  g.fillStyle(0x6f8f4a, 1);
  g.fillEllipse(84, 1120, 110, 44);
  g.lineStyle(9, 0x6f8f4a, 1);
  for (let i = 0; i < 5; i += 1) {
    g.lineBetween(84, 1112, 84 - 46 + i * 24, 962 + (i % 2) * 34);
  }
}

// ---------------- 每帧 ----------------

/** 换回来的东西值多少：几行、多大、亮不亮 */
function returnLines(kind: string): number {
  if (kind === 'poem') return 4;
  if (kind === 'couplet') return 2;
  return 1;
}

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: LureStageState,
  level: LureLevel,
): void {
  if (state.mode !== 'trade' || level.mode !== 'trade') return;

  // 三样东西：递出去过的那几样淡下去（"已经给过了"）
  const last = state.lastOffer;
  for (const offer of level.offers) {
    const given = state.given.includes(offer.id);
    drawOffer(g, offer, given, last !== null && last.id === offer.id && state.sinceTradeMs < 700);
  }

  // 对方：递出去之后会把手抬高一点（"我拿出来了"）
  const raised = state.lastReturn !== null && state.sinceTradeMs < 1600;
  drawScholar(g, PARTNER.x, PARTNER.y, 1, raised);

  // 换回来的东西：从对方手上飘出来，越大越亮说明换回得越多
  const back = state.lastReturn;
  if (back !== null) {
    const p = Math.min(1, state.sinceTradeMs / 420);
    const glow = state.sinceTradeMs < 900 ? 1 - state.sinceTradeMs / 900 : 0;
    const x = PARTNER.x + (RETURN_AT.x - PARTNER.x) * p;
    const y = PARTNER.y - 150 + (RETURN_AT.y - PARTNER.y + 150) * p;
    const s = 0.62 + Math.min(1, back.value / 6) * 0.38;
    drawSlip(g, x, y, s, returnLines(back.kind), glow);
  }

  // 换到几成：几格玉
  const { x, y, w, h, cells } = JADE_BAR;
  roundRect(g, x - 10, y - 10, w + 20, h + 20, (h + 20) / 2, shade(THEME.card, 0.98), THEME.outline, 5);
  const cellW = (w - (cells - 1) * 6) / cells;
  const filled = Math.round((state.best / Math.max(1, state.needed)) * cells);
  for (let i = 0; i < cells; i += 1) {
    // 每一格代表"玉"的一分：换到几分就亮几格
    const lit = i < Math.max(0, Math.min(cells, filled));
    roundRect(g, x + i * (cellW + 6), y, cellW, h, 12, lit ? JADE : shade(THEME.card, 0.9), THEME.outline, 4);
    if (lit) {
      g.fillStyle(THEME.paper, 0.9);
      g.fillCircle(x + i * (cellW + 6) + cellW / 2, y + h / 2, h * 0.18);
    }
  }
}

/** 收尾：第三列终于写上了好句，那枚玉坠亮在墙上 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: LureStageState,
  level: LureLevel,
): void {
  if (state.mode !== 'trade' || level.mode !== 'trade') return;
  g.fillStyle(THEME.gold, 0.2);
  g.fillEllipse(RETURN_COLUMN_X, (WALL_TOP + WALL_BOTTOM) / 2, 420, 420);
  g.lineStyle(10, THEME.gold, 0.6);
  g.strokeRect(RETURN_COLUMN_X - 52, WALL_TOP + 24, 104, WALL_BOTTOM - WALL_TOP - 48);
  drawColumn(g, RETURN_COLUMN_X, WALL_TOP + 62, 4, 74);
  circle(g, RETURN_COLUMN_X, WALL_BOTTOM - 44, 26, JADE, THEME.outline, 6);
}

// ---------------- 分幕插图 ----------------

/**
 * 分幕插图：① 墙上只有两句，没人接着写
 * ② 常建先写下两句，路过的人看见了，把后面的好句补上
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(FLOOR, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  const wallX = x + w * 0.06;
  const wallY = y + h * 0.08;
  const wallW = w * 0.88;
  const wallH = h * 0.5;
  roundRect(g, wallX - 12, wallY - 12, wallW + 24, wallH + 24, 16, FRAME, THEME.outline, 6);
  roundRect(g, wallX, wallY, wallW, wallH, 8, WALL, null, 0);

  // 第一列：常建写的那两句（第二幕里也是"先写下的"）
  drawColumn(g, wallX + wallW * 0.24, wallY + wallH * 0.16, 3, 52);
  if (index > 0) {
    // 第二幕：过路人把后面的好句补上（第二列 + 一枚玉坠）
    drawColumn(g, wallX + wallW * 0.62, wallY + wallH * 0.16, 3, 52);
    g.fillStyle(THEME.gold, 0.2);
    g.fillEllipse(wallX + wallW * 0.62, wallY + wallH * 0.5, wallW * 0.5, wallH * 1.1);
    circle(g, wallX + wallW * 0.62, wallY + wallH - 26, 16, JADE, THEME.outline, 5);
  } else {
    // 第一幕：第三列空着 —— 一个淡淡的框
    g.lineStyle(5, shade(WALL_DEEP, 0.92), 0.9);
    g.strokeRect(wallX + wallW * 0.5, wallY + wallH * 0.1, wallW * 0.3, wallH * 0.8);
  }

  // 案与砚台
  const tableY = y + h * 0.7;
  roundRect(g, x + w * 0.1, tableY, w * 0.8, h * 0.07, 14, FRAME, THEME.outline, 6);
  roundRect(g, x + w * 0.16, tableY + h * 0.07, 22, h * 0.14, 8, shade(FRAME, 0.86), THEME.outline, 5);
  roundRect(g, x + w * 0.78, tableY + h * 0.07, 22, h * 0.14, 8, shade(FRAME, 0.86), THEME.outline, 5);
  circle(g, x + w * 0.36, tableY - 14, 20, 0x2f2a25, THEME.outline, 5);
  g.lineStyle(9, THEME.wood, 1);
  g.lineBetween(x + w * 0.52, tableY - 4, x + w * 0.62, tableY - 62);

  // 人：第一幕是常建一个人在写，第二幕是两个人（一个写，一个补）
  drawScholar(g, x + w * 0.3, y + h * 0.94, 0.62, false);
  if (index > 0) drawScholar(g, x + w * 0.74, y + h * 0.94, 0.62, true);
}
