import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN, PROBE } from '@chags/templates';
import type { ProbeStageState } from '@chags/templates';
import type { ProbeLevel } from '@chags/templates/schemas';
import {
  ARCHER, ARROW, ASIDE_SHIFT, ASIDE_Y, FIELD_TOP, FIGURE_Y, HILLS, KING_INDEX, WALL,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
/** 敌我衣甲一模一样 —— 这一计的全部难处就在这儿 */
const ARMOR = shade(THEME.teal, 0.8);
const ARMOR_DEEP = shade(THEME.teal, 0.6);
/** 蒿草的颜色：蒿箭就是这种草削的 */
const REED = 0xd8c98d;
const SKIN = 0xf8dcbb;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// ---------------- 景（画一次） ----------------

/** 城外的旷野、远处的山、画面下方我们自己的城墙 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: ProbeLevel): void {
  if (level.mode !== 'spot') return;

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);
  g.fillStyle(shade(THEME.skyDeep, 1), 1);
  g.fillRect(0, FIELD_TOP, W, 300);
  for (const hill of HILLS) {
    g.fillStyle(shade(THEME.teal, 0.7), 0.45);
    g.fillEllipse(hill.x, hill.y, hill.w, hill.h);
  }
  // 旷野
  g.fillStyle(THEME.sand, 1);
  g.fillRect(0, FIELD_TOP + 330, W, H - FIELD_TOP - 330);
  g.fillStyle(shade(THEME.sandDeep, 1.0), 1);
  g.fillEllipse(W * 0.35, 760, 700, 220);
  g.fillEllipse(W * 0.85, 620, 520, 180);
  // 一阵一阵的尘土（他们站的地方）
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle(shade(THEME.sandDeep, 0.92), 0.35);
    g.fillEllipse(120 + i * 190, 470 + (i % 2) * 60, 260, 46);
  }
  drawWall(g);
}

/** 我们的城头：一排垛口，张巡就站在后面 */
function drawWall(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(shade(THEME.stone, 1.02), 1);
  g.fillRect(0, WALL.top, W, H - WALL.top);
  g.lineStyle(4, shade(THEME.stone, 0.86), 1);
  for (let y = WALL.top + 72; y < H; y += 68) g.lineBetween(0, y, W, y);
  for (let row = 0; row < 6; row += 1) {
    const y = WALL.top + 72 + row * 68;
    for (let x = row % 2 === 0 ? 0 : 70; x < W; x += 140) g.lineBetween(x, y - 68, x, y);
  }
  // 垛口
  for (let x = -24; x < W + 60; x += WALL.merlonGap) {
    roundRect(g, x, WALL.top - 58, 60, 62, 8, shade(THEME.stone, 0.94), THEME.outline, 5);
  }
}

// ---------------- 一排身影 ----------------

/** 退到一边的进度：刚射中的那一个往下走，早就在一边的就在一边 */
function asideProgress(state: ProbeStageState, figureId: string): number {
  if (state.lastShot !== null && state.lastShot.id === figureId) {
    return clamp01((state.elapsedMs - state.lastShotAtMs) / PROBE.stepAsideMs);
  }
  return 1;
}

/**
 * 一个身影。六个人从头到脚一模一样 —— 连盔顶那撮红缨都一样；
 * 只有**被找到之后**，王才会转过身来、把手举起来（这一眼就是全部答案）。
 */
function drawSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  opts: { alpha: number; king: boolean; bowed: boolean },
): void {
  const { alpha, king, bowed } = opts;
  groundShadow(g, x, y + 6, 96, 26, 0.16 * alpha);

  // 长矛（人人有份，立在右手边）
  g.lineStyle(8, THEME.wood, alpha);
  g.lineBetween(x + 42, y + 10, x + 42, y - 152);
  g.fillStyle(THEME.stone, alpha);
  g.fillTriangle(x + 34, y - 150, x + 50, y - 150, x + 42, y - 190);
  g.lineStyle(5, THEME.outline, alpha);
  g.strokeTriangle(x + 34, y - 150, x + 50, y - 150, x + 42, y - 190);

  // 甲与腰带
  roundRect(g, x - 34, y - 106, 68, 112, 20, ARMOR, THEME.outline, 6, alpha);
  g.lineStyle(9, THEME.outline, alpha);
  g.lineBetween(x - 34, y - 56, x + 34, y - 56);
  circle(g, x - 31, y - 94, 16, ARMOR_DEEP, THEME.outline, 5, alpha);
  circle(g, x + 31, y - 94, 16, ARMOR_DEEP, THEME.outline, 5, alpha);

  // 头与头盔（被射中的人低着头退到一边）
  const headY = y - 134 + (bowed ? 14 : 0);
  circle(g, x, headY, 25, SKIN, THEME.outline, 6, alpha);
  circle(g, x, headY - 12, 26, THEME.inkSoft, THEME.outline, 6, alpha);
  g.fillStyle(THEME.red, alpha);
  g.fillTriangle(x - 12, headY - 32, x + 12, headY - 32, x, headY - 62);
  g.fillStyle(THEME.outline, alpha);
  g.fillCircle(x - 9, headY + 4, 3.4);
  g.fillCircle(x + 9, headY + 4, 3.4);

  if (!king) return;

  // 就是他：转过身来、两只手举起来喝令（没有一个人受伤）
  g.lineStyle(9, THEME.gold, 0.85);
  g.strokeCircle(x, y - 70, 104);
  g.lineStyle(9, THEME.gold, 0.35);
  g.strokeCircle(x, y - 70, 132);
  g.lineStyle(13, ARMOR, 1);
  g.lineBetween(x - 26, y - 92, x - 60, y - 156);
  g.lineBetween(x + 26, y - 92, x + 60, y - 156);
  circle(g, x - 62, y - 160, 13, SKIN, THEME.outline, 5);
  circle(g, x + 62, y - 160, 13, SKIN, THEME.outline, 5);
  g.lineStyle(7, THEME.red, 0.95);
  g.beginPath();
  g.arc(x + 34, headY - 6, 44, -0.75, 0.5);
  g.strokePath();
  g.beginPath();
  g.arc(x - 34, headY - 6, 44, Math.PI - 0.5, Math.PI + 0.75);
  g.strokePath();
}

// ---------------- 张巡与蒿箭 ----------------

/** 城头上的张巡：一张弓，一捆蒿箭 */
function drawArcher(g: Phaser.GameObjects.Graphics, state: ProbeStageState): void {
  const x = ARCHER.x;
  const y = ARCHER.y;
  const since = state.lastShot === null ? Number.POSITIVE_INFINITY : state.elapsedMs - state.lastShotAtMs;
  const drawing = since >= -PROBE.shotMs && since <= PROBE.shotMs;
  const pull = drawing ? 0.9 : 0.25;

  groundShadow(g, x, y + 8, 124, 30, 0.2);
  roundRect(g, x - 40, y - 108, 80, 112, 24, shade(THEME.redDeep, 1.02), THEME.outline, 6);
  g.lineStyle(10, THEME.gold, 1);
  g.lineBetween(x - 40, y - 58, x + 40, y - 58);
  g.lineStyle(5, shade(THEME.redDeep, 0.8), 1);
  g.lineBetween(x - 20, y - 108, x - 20, y + 4);
  g.lineBetween(x + 20, y - 108, x + 20, y + 4);
  circle(g, x, y - 136, 27, SKIN, THEME.outline, 6);
  circle(g, x, y - 160, 24, THEME.inkSoft, THEME.outline, 6);
  roundRect(g, x - 40, y - 156, 80, 16, 8, THEME.inkSoft, THEME.outline, 5);

  // 蒿箭捆在脚边（够用，随便试）
  for (let i = 0; i < 3; i += 1) {
    g.lineStyle(6, REED, 1);
    g.lineBetween(x + 54 + i * 7, y + 4, x + 76 + i * 7, y - 44);
    g.lineStyle(4, shade(REED, 0.86), 1);
    g.lineBetween(x + 76 + i * 7, y - 44, x + 82 + i * 7, y - 56);
  }

  // 弓与弦
  g.lineStyle(10, THEME.wood, 1);
  g.beginPath();
  g.arc(x + 46, y - 108, 66, -1.3, 1.3);
  g.strokePath();
  const tipTop = { x: x + 64, y: y - 172 };
  const tipBottom = { x: x + 64, y: y - 44 };
  const nock = { x: x + 64 - 34 * pull, y: y - 108 };
  g.lineStyle(4, THEME.paperDeep, 1);
  g.lineBetween(tipTop.x, tipTop.y, nock.x, nock.y);
  g.lineBetween(tipBottom.x, tipBottom.y, nock.x, nock.y);
  if (!drawing) {
    // 没射的时候搭着一枝蒿箭
    g.lineStyle(6, REED, 1);
    g.lineBetween(nock.x, nock.y, nock.x + 96, nock.y);
  }
}

/** 飞在半路的那一枝蒿箭：秆 + 一撮草穗（钝头，没有杀伤） */
function drawArrow(g: Phaser.GameObjects.Graphics, state: ProbeStageState): void {
  const shot = state.lastShot;
  if (shot === null) return;
  const since = state.elapsedMs - state.lastShotAtMs;
  if (since < 0 || since > PROBE.shotMs) return;
  const p = clamp01(since / PROBE.shotMs);
  const from = { x: ARCHER.x + 60, y: ARCHER.y - 158 };
  const to = { x: shot.x, y: shot.y };
  const x = from.x + (to.x - from.x) * p;
  const y = from.y + (to.y - from.y) * p - Math.sin(Math.PI * p) * 76;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);

  g.lineStyle(ARROW.width, REED, 1);
  g.lineBetween(x - dx * ARROW.len, y - dy * ARROW.len, x, y);
  // 草穗：钝的一头
  g.lineStyle(5, shade(REED, 0.84), 1);
  for (let i = -2; i <= 2; i += 1) {
    g.lineBetween(x, y, x + dx * 26 + nx * i * 10, y + dy * 26 + ny * i * 10);
  }
  // 尾羽
  g.lineStyle(5, THEME.paperDeep, 1);
  g.lineBetween(x - dx * ARROW.len, y - dy * ARROW.len, x - dx * ARROW.len + nx * 14 - dx * 18, y - dy * ARROW.len + ny * 14 - dy * 18);
  g.lineBetween(x - dx * ARROW.len, y - dy * ARROW.len, x - dx * ARROW.len - nx * 14 - dx * 18, y - dy * ARROW.len - ny * 14 - dy * 18);
}

// ---------------- 每帧 ----------------

/** 每帧：六个人（谁退到一边了、谁被找出来了）、张巡、飞在半路的蒿箭 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: ProbeStageState,
  level: ProbeLevel,
): void {
  if (level.mode !== 'spot') return;
  const middle = (level.figures.length - 1) / 2;
  level.figures.forEach((figure, index) => {
    const tried = state.tried.includes(figure.id);
    const p = tried ? asideProgress(state, figure.id) : 0;
    const side = index <= middle ? -1 : 1;
    const x = figure.x + side * ASIDE_SHIFT * p;
    const y = FIGURE_Y + (ASIDE_Y - FIGURE_Y) * p;
    drawSoldier(g, x, y, {
      alpha: 1 - 0.4 * p,
      king: state.king === figure.id,
      bowed: tried && p > 0.55,
    });
  });
  drawArcher(g, state);
  drawArrow(g, state);
}

/** 收尾：就是他 —— 金光落在那一个人身上 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: ProbeStageState,
  level: ProbeLevel,
): void {
  if (level.mode !== 'spot') return;
  const king = level.figures.find((figure) => figure.id === state.king) ?? level.figures[KING_INDEX]!;
  g.fillStyle(THEME.gold, 0.2);
  g.fillCircle(king.x, king.y - 60, 200);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(king.x, king.y - 60, 176);
}

// ---------------- 分幕插图 ----------------

/** 插图里的一个人：更小、更简，但六个人还是一模一样 */
function drawBeatSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  turned: boolean,
): void {
  groundShadow(g, x, y + 4 * scale, 70 * scale, 18 * scale, 0.16);
  roundRect(g, x - 22 * scale, y - 70 * scale, 44 * scale, 74 * scale, 14 * scale, ARMOR, THEME.outline, 5);
  g.lineStyle(6 * scale, THEME.wood, 1);
  g.lineBetween(x + 28 * scale, y + 6 * scale, x + 28 * scale, y - 104 * scale);
  circle(g, x, y - 90 * scale, 17 * scale, SKIN, THEME.outline, 5);
  circle(g, x, y - 104 * scale, 18 * scale, THEME.inkSoft, THEME.outline, 5);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x - 9 * scale, y - 118 * scale, x + 9 * scale, y - 118 * scale, x, y - 138 * scale);
  if (!turned) return;
  g.lineStyle(7 * scale, ARMOR, 1);
  g.lineBetween(x - 18 * scale, y - 62 * scale, x - 44 * scale, y - 104 * scale);
  g.lineBetween(x + 18 * scale, y - 62 * scale, x + 44 * scale, y - 104 * scale);
  g.lineStyle(7 * scale, THEME.gold, 0.9);
  g.strokeCircle(x, y - 50 * scale, 62 * scale);
}

/** 分幕插图：① 对面一排穿得一模一样的人 ② 一枝蒿箭射过去，那个回头的就是他 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.sky, 1.02), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 1), 1);
  g.fillRoundedRect(x, y + h * 0.5, w, h * 0.5, 30);
  g.fillStyle(shade(THEME.teal, 0.7), 0.4);
  g.fillEllipse(x + w * 0.2, y + h * 0.42, w * 0.6, h * 0.24);
  g.fillEllipse(x + w * 0.8, y + h * 0.46, w * 0.7, h * 0.26);

  const lineY = y + h * 0.66;
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const sx = x + w * 0.14 + (i * w * 0.72) / (count - 1);
    drawBeatSoldier(g, sx, lineY, 1, index === 1 && i === 3);
  }

  if (index === 0) {
    // ① 看不出谁在发号施令：一排问号
    g.lineStyle(7, THEME.inkSoft, 0.75);
    for (let i = 1; i < count - 1; i += 2) {
      const sx = x + w * 0.14 + (i * w * 0.72) / (count - 1);
      g.strokeCircle(sx, y + h * 0.24, 16);
      g.lineBetween(sx - 16, y + h * 0.24, sx + 16, y + h * 0.24);
    }
    return;
  }

  // ② 一枝没有杀伤的蒿箭飞过去
  g.lineStyle(8, REED, 1);
  g.lineBetween(x + w * 0.06, lineY - h * 0.06, x + w * 0.52, lineY - h * 0.16);
  g.lineStyle(5, shade(REED, 0.84), 1);
  for (let i = -2; i <= 2; i += 1) {
    g.lineBetween(x + w * 0.52, lineY - h * 0.16, x + w * 0.58, lineY - h * 0.16 + i * 9 - 22);
  }
  g.lineStyle(6, THEME.red, 0.9);
  g.beginPath();
  g.arc(x + w * 0.62, lineY - h * 0.2, 34, -0.7, 0.5);
  g.strokePath();
}
