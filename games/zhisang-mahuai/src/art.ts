import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { ProbeHintStageState } from '@chags/templates';
import type { ProbeHintLevel } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';
import {
  BAR, GROUND_TOP, LACQUER, LISTENER_PATH, PROPS, PROP_RADIUS, PROP_Y, STEP_MS, STEPS, WALL,
  YOUSAN,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 宫墙的朱红、苑囿的地、树与鼓的木头、铜的钟 */
const WALL_RED = shade(THEME.redDeep, 0.94);
const WALL_RED_DEEP = shade(THEME.redDeep, 0.74);
const GROUND = THEME.sand;
const GROUND_DEEP = THEME.sandDeep;
const TRUNK = THEME.wood;
const TRUNK_DEEP = THEME.woodDeep;
const LEAF = THEME.leaf;
const LEAF_DEEP = shade(THEME.leaf, 0.78);
const POD = shade(THEME.leaf, 1.16);
const BRONZE = shade(THEME.goldDeep, 1.06);
const SKIN = 0xf8dcbb;
const ROBE = shade(THEME.teal, 0.86);
const KING_ROBE = shade(THEME.red, 0.92);


// ---------------- 景（画一次） ----------------

/** 要漆的那段宫墙：朱红的墙身、一排瓦、两头的阙 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: ProbeHintLevel): void {
  // 天
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 0, W, H);
  // 远处的宫阙（左右各一座）
  for (const x of [86, 664]) {
    g.fillStyle(shade(THEME.redDeep, 0.66), 0.5);
    g.fillRect(x - 70, WALL.top + 24, 140, WALL.bottom - WALL.top - 24);
    g.fillStyle(shade(THEME.tealDeep, 0.86), 0.7);
    g.fillTriangle(x - 96, WALL.top + 30, x + 96, WALL.top + 30, x, WALL.top - 34);
  }
  // 墙身
  g.fillStyle(WALL_RED, 1);
  g.fillRect(-10, WALL.top, W + 20, WALL.bottom - WALL.top);
  g.fillStyle(WALL_RED_DEEP, 1);
  g.fillRect(-10, WALL.bottom - 26, W + 20, 26);
  // 墙头的一排瓦与垛口
  for (let x = -20; x < W + 40; x += WALL.merlonGap) {
    roundRect(g, x, WALL.top - 6, 62, 30, 8, shade(THEME.tealDeep, 0.9), THEME.outline, 5);
  }
  roundRect(g, -20, WALL.top + 24, W + 40, 18, 6, shade(THEME.goldDeep, 0.9), THEME.outline, 4);
  // 墙上的漆光：二世想着的那件事（还没漆完，只亮了一条）
  g.fillStyle(THEME.gold, 0.16);
  g.fillRect(-10, WALL.top + 60, W + 20, 46);
  g.lineStyle(4, THEME.paper, 0.5);
  for (let x = 20; x < W; x += 96) g.lineBetween(x, WALL.top + 74, x + 40, WALL.top + 74);

  // 苑囿的地
  g.fillStyle(GROUND, 1);
  g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  g.fillStyle(GROUND_DEEP, 1);
  g.fillEllipse(W * 0.3, 700, 720, 240);
  g.fillEllipse(W * 0.8, 900, 600, 220);
  g.fillStyle(shade(GROUND_DEEP, 0.94), 1);
  g.fillRect(0, 1160, W, H - 1160);

  // 墙角那一桶漆与刷子：这一关要劝的就是这件事
  drawLacquer(g);
  // 四样东西脚下的土台（东西本身由 drawStage 画）
  for (const prop of PROPS) {
    g.fillStyle(shade(GROUND_DEEP, 0.92), 1);
    g.fillEllipse(prop.x, PROP_Y + PROP_RADIUS + 6, 172, 40);
    g.lineStyle(5, THEME.outline, 0.4);
    g.strokeEllipse(prop.x, PROP_Y + PROP_RADIUS + 6, 172, 40);
  }
  void level;
}

function drawLacquer(g: Phaser.GameObjects.Graphics): void {
  const { x, y, r } = LACQUER;
  groundShadow(g, x, y + r, r * 2.6, 30, 0.18);
  // 木桶
  roundRect(g, x - r, y - r, r * 2, r * 2, 16, TRUNK, THEME.outline, 6);
  g.fillStyle(shade(THEME.ink, 0.9), 0.85);
  g.fillEllipse(x, y - r + 4, r * 1.8, 20);
  g.lineStyle(6, TRUNK_DEEP, 1);
  g.lineBetween(x - r + 6, y - 10, x + r - 6, y - 10);
  g.lineBetween(x - r + 8, y + 16, x + r - 8, y + 16);
  // 刷子靠在桶边
  g.lineStyle(10, TRUNK_DEEP, 1);
  g.lineBetween(x + r - 6, y + r, x + r + 26, y - r - 30);
  g.fillStyle(THEME.gold, 1);
  g.fillEllipse(x + r + 30, y - r - 40, 30, 22);
}

// ---------------- 四样东西 ----------------

/** 一棵树：树干 + 三团叶子（桑树挂紫果、槐树垂豆荚） */
function drawTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  kind: 'mulberry' | 'ash',
  knocked: boolean,
): void {
  const foot = PROP_Y + PROP_RADIUS;
  groundShadow(g, x, foot + 4, 150, 32, 0.2);
  g.lineStyle(22, TRUNK, 1);
  g.lineBetween(x, foot, x, foot - 132);
  g.fillStyle(TRUNK_DEEP, 1);
  g.fillEllipse(x, foot - 4, 46, 18);
  // 树冠
  g.fillStyle(knocked ? LEAF_DEEP : LEAF, 1);
  g.fillEllipse(x, PROP_Y - 34, 168, 118);
  g.fillEllipse(x - 58, PROP_Y - 8, 108, 84);
  g.fillEllipse(x + 58, PROP_Y - 14, 112, 88);
  g.lineStyle(6, THEME.outline, 0.75);
  g.strokeEllipse(x, PROP_Y - 34, 168, 118);
  if (kind === 'mulberry') {
    // 桑：叶子间几颗紫红的桑葚
    g.fillStyle(shade(THEME.redDeep, 1.3), 1);
    for (const [dx, dy] of [[-34, -18], [12, -44], [44, -6], [-8, 24], [26, 34]]) {
      g.fillCircle(x + dx, PROP_Y - 34 + dy, 9);
    }
    return;
  }
  // 槐：垂下来的一串串豆荚
  g.lineStyle(7, POD, 1);
  for (let i = 0; i < 4; i += 1) {
    const dx = -48 + i * 32;
    g.lineBetween(x + dx, PROP_Y - 10, x + dx - 6, PROP_Y + 46);
    g.fillStyle(POD, 1);
    g.fillEllipse(x + dx - 8, PROP_Y + 52, 18, 26);
  }
}

/** 钟：木架子上挂的一口铜钟（敲它只有钟声） */
function drawBell(g: Phaser.GameObjects.Graphics, x: number, knocked: boolean): void {
  const foot = PROP_Y + PROP_RADIUS;
  groundShadow(g, x, foot + 4, 150, 32, 0.2);
  g.lineStyle(20, TRUNK, 1);
  g.lineBetween(x - 74, foot, x - 74, PROP_Y - 108);
  g.lineBetween(x + 74, foot, x + 74, PROP_Y - 108);
  g.lineStyle(20, TRUNK_DEEP, 1);
  g.lineBetween(x - 92, PROP_Y - 108, x + 92, PROP_Y - 108);
  // 钟
  g.fillStyle(knocked ? shade(BRONZE, 0.84) : BRONZE, 1);
  g.fillTriangle(x - 66, PROP_Y + 78, x + 66, PROP_Y + 78, x + 20, PROP_Y - 74);
  g.fillTriangle(x - 66, PROP_Y + 78, x - 20, PROP_Y - 74, x + 20, PROP_Y - 74);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 66, PROP_Y + 78, x + 66, PROP_Y + 78, x + 20, PROP_Y - 74);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x - 66, PROP_Y + 78, x + 66, PROP_Y + 78);
  g.fillStyle(shade(BRONZE, 1.2), 1);
  g.fillRect(x - 58, PROP_Y + 30, 116, 14);
  g.lineStyle(8, TRUNK_DEEP, 1);
  g.lineBetween(x, PROP_Y - 74, x, PROP_Y - 104);
}

/** 鼓：木架上一面大鼓，两根鼓槌（他听得懂的那一样） */
function drawDrum(g: Phaser.GameObjects.Graphics, x: number, knocked: boolean): void {
  const foot = PROP_Y + PROP_RADIUS;
  groundShadow(g, x, foot + 4, 168, 34, 0.2);
  // 架子
  g.lineStyle(18, TRUNK_DEEP, 1);
  g.lineBetween(x - 78, foot, x - 40, PROP_Y - 20);
  g.lineBetween(x + 78, foot, x + 40, PROP_Y - 20);
  g.lineStyle(14, TRUNK, 1);
  g.lineBetween(x - 86, foot - 20, x + 86, foot - 20);
  // 鼓身：一截横着的圆桶 + 鼓面
  g.fillStyle(knocked ? shade(THEME.red, 0.9) : THEME.red, 1);
  g.fillRoundedRect(x - 62, PROP_Y - 96, 124, 150, 34);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeRoundedRect(x - 62, PROP_Y - 96, 124, 150, 34);
  g.fillStyle(THEME.paper, 1);
  g.fillEllipse(x, PROP_Y - 92, 128, 44);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, PROP_Y - 92, 128, 44);
  g.fillStyle(THEME.gold, 1);
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    g.fillCircle(x + Math.cos(angle) * 58, PROP_Y - 92 + Math.sin(angle) * 20, 4.5);
  }
  // 两根鼓槌搭在鼓边
  g.lineStyle(10, TRUNK, 1);
  g.lineBetween(x + 44, PROP_Y + 52, x + 92, PROP_Y + 12);
  g.lineStyle(10, TRUNK, 1);
  g.lineBetween(x + 40, PROP_Y + 62, x + 96, PROP_Y + 30);
  g.fillStyle(THEME.goldDeep, 1);
  g.fillCircle(x + 94, PROP_Y + 10, 9);
  g.fillCircle(x + 98, PROP_Y + 28, 9);
}

/** 敲过了：东西脚下一个小勾（记号，不是分数） */
function drawKnockedMark(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  circle(g, x, y, 26, THEME.paper, THEME.outline, 5);
  g.lineStyle(9, THEME.teal, 1);
  g.beginPath();
  g.moveTo(x - 11, y + 1);
  g.lineTo(x - 3, y + 10);
  g.lineTo(x + 12, y - 10);
  g.strokePath();
}

// ---------------- 两个人 ----------------

/** 优旃：矮矮胖胖的乐师，手里一把扇子（他站在鼓边上） */
function drawYousan(g: Phaser.GameObjects.Graphics, waving: boolean): void {
  const { x, y } = YOUSAN;
  groundShadow(g, x, y + 4, 96, 26, 0.2);
  roundRect(g, x - 32, y - 92, 64, 96, 24, ROBE, THEME.outline, 6);
  g.lineStyle(8, THEME.gold, 1);
  g.lineBetween(x - 30, y - 48, x + 30, y - 48);
  circle(g, x, y - 114, 26, SKIN, THEME.outline, 6);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillEllipse(x, y - 142, 44, 20);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 9, y - 114, 3.6);
  g.fillCircle(x + 9, y - 114, 3.6);
  // 笑着的一张嘴
  g.lineStyle(5, THEME.outline, 1);
  g.beginPath();
  g.arc(x, y - 106, 10, 0.3, Math.PI - 0.3);
  g.strokePath();
  // 扇子
  const lift = waving ? 30 : 0;
  g.fillStyle(THEME.paper, 1);
  g.fillEllipse(x + 56, y - 120 - lift, 56, 34);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x + 56, y - 120 - lift, 56, 34);
  g.lineStyle(7, TRUNK_DEEP, 1);
  g.lineBetween(x + 34, y - 96 - lift, x + 56, y - 118 - lift);
}

/** 二世：戴着冕的国君（走够 steps 步，他自己笑起来） */
function drawKing(g: Phaser.GameObjects.Graphics, x: number, y: number, laughing: boolean): void {
  groundShadow(g, x, y + 4, 116, 30, 0.2);
  roundRect(g, x - 42, y - 118, 84, 122, 26, KING_ROBE, THEME.outline, 6);
  g.fillStyle(THEME.gold, 1);
  g.fillRect(x - 42, y - 74, 84, 14);
  g.fillStyle(shade(KING_ROBE, 0.82), 1);
  g.fillEllipse(x, y - 6, 96, 22);
  // 头与冕
  circle(g, x, y - 146, 28, SKIN, THEME.outline, 6);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillRect(x - 40, y - 186, 80, 16);
  g.fillEllipse(x, y - 196, 60, 22);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 10, y - 146, 4);
  g.fillCircle(x + 10, y - 146, 4);
  g.lineStyle(5, THEME.outline, 1);
  if (laughing) {
    // 笑着的一张嘴 + 眯起来的眼睛
    g.beginPath();
    g.arc(x, y - 138, 12, 0.25, Math.PI - 0.25);
    g.strokePath();
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(x - 18, y - 158, x - 2, y - 154);
    g.lineBetween(x + 18, y - 158, x + 2, y - 154);
    return;
  }
  g.beginPath();
  g.moveTo(x - 12, y - 132);
  g.lineTo(x + 12, y - 132);
  g.strokePath();
}

// ---------------- 每帧 ----------------

/** 他走到第几格了（0..steps）：刚敲响那一步，从上一格走一格过去 */
function walkIndex(state: ProbeHintStageState): number {
  const done = state.progress;
  if (!state.lastWasWanted) return done;
  const since = state.elapsedMs - state.lastKnockAtMs;
  if (since < 0 || since > STEP_MS) return done;
  return Math.max(0, done - 1 + clamp01(since / STEP_MS));
}

function pathAt(t: number): { x: number; y: number } {
  const max = LISTENER_PATH.length - 1;
  const clamped = Math.max(0, Math.min(max, t));
  const index = Math.min(max - 1, Math.floor(clamped));
  const local = clamped - index;
  const from = LISTENER_PATH[index]!;
  const to = LISTENER_PATH[index + 1]!;
  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local };
}

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: ProbeHintStageState,
  level: ProbeHintLevel,
): void {
  // 四样东西：敲过的那几样脚下有一个小勾
  for (const prop of PROPS) {
    const knocked = state.knocked.includes(prop.id);
    if (prop.kind === 'mulberry') drawTree(g, prop.x, 'mulberry', knocked);
    else if (prop.kind === 'ash') drawTree(g, prop.x, 'ash', knocked);
    else if (prop.kind === 'bell') drawBell(g, prop.x, knocked);
    else drawDrum(g, prop.x, knocked);
    if (knocked) drawKnockedMark(g, prop.x - PROP_RADIUS + 6, PROP_Y + PROP_RADIUS + 40);
  }

  // 优旃：敲对的那一下他会跟着扬一下扇子
  const justHeard = state.lastWasWanted && state.elapsedMs - state.lastKnockAtMs <= STEP_MS;
  drawYousan(g, justHeard);

  // 二世：他往前走的那几格
  const at = pathAt(walkIndex(state));
  drawKing(g, at.x, at.y, state.done || walkIndex(state) >= STEPS);

  // 走够几步（左下角）：一格一格亮起来
  const { x, y, w, h } = BAR;
  g.fillStyle(THEME.card, 0.94);
  g.fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x, y, w, h, h / 2);
  for (let i = 0; i < STEPS; i += 1) {
    const cellW = (w - 20) / STEPS;
    const filled = i < state.progress;
    g.fillStyle(filled ? THEME.gold : shade(THEME.stone, 1.02), filled ? 1 : 0.7);
    g.fillRoundedRect(x + 10 + i * cellW + 3, y + 8, cellW - 6, h - 16, (h - 16) / 2);
  }
  void level;
}

/** 收尾：他笑起来了 —— 漆桶翻在一边，漆城的事就此放下 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: ProbeHintStageState,
  level: ProbeHintLevel,
): void {
  const { x, y } = LACQUER;
  g.fillStyle(THEME.gold, 0.14);
  g.fillEllipse(W / 2, 660, 720, 620);
  // 桶翻了，漆洒了一地（这件事不做了）
  g.fillStyle(shade(THEME.ink, 0.9), 0.5);
  g.fillEllipse(x + 40, y + 96, 240, 70);
  g.lineStyle(9, THEME.gold, 0.5);
  g.strokeCircle(LISTENER_PATH[STEPS]!.x, LISTENER_PATH[STEPS]!.y - 120, 150);
  g.lineStyle(9, THEME.gold, 0.28);
  g.strokeCircle(LISTENER_PATH[STEPS]!.x, LISTENER_PATH[STEPS]!.y - 120, 210);
  void state;
  void level;
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 二世指着要漆的城墙 ② 优旃顺着他说，两个人一起笑 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.sky, 1.02), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(GROUND, 1);
  g.fillRoundedRect(x, y + h * 0.62, w, h * 0.38, 30);

  // 那段墙：第一幕只亮着一条漆光，第二幕整段都亮
  g.fillStyle(WALL_RED, 1);
  g.fillRect(x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.34);
  g.fillStyle(WALL_RED_DEEP, 1);
  g.fillRect(x + w * 0.08, y + h * 0.42, w * 0.84, h * 0.04);
  for (let i = 0; i < 6; i += 1) {
    roundRect(g, x + w * 0.08 + i * (w * 0.84) / 6, y + h * 0.08, w * 0.1, h * 0.05, 6, shade(THEME.tealDeep, 0.9), THEME.outline, 4);
  }
  g.fillStyle(THEME.gold, index === 0 ? 0.16 : 0.3);
  g.fillRect(x + w * 0.08, y + h * (index === 0 ? 0.24 : 0.16), w * 0.84, h * (index === 0 ? 0.06 : 0.26));

  const lineY = y + h * 0.92;
  if (index === 0) {
    // ① 二世指着墙，旁边一桶漆
    drawKing(g, x + w * 0.24, lineY, false);
    drawLacquerSmall(g, x + w * 0.62, lineY - 6);
    g.lineStyle(9, SKIN, 1);
    g.lineBetween(x + w * 0.3, lineY - 130, x + w * 0.42, lineY - 168);
    return;
  }
  // ② 优旃顺着他说，两个人一起笑
  drawKing(g, x + w * 0.66, lineY, true);
  drawYousanSmall(g, x + w * 0.3, lineY);
  g.lineStyle(6, THEME.gold, 0.85);
  g.strokeCircle(x + w * 0.48, lineY - 150, 26);
  g.strokeCircle(x + w * 0.48, lineY - 150, 44);
}

/** 插图里的漆桶 */
function drawLacquerSmall(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  roundRect(g, x - 34, y - 62, 68, 66, 14, TRUNK, THEME.outline, 5);
  g.fillStyle(shade(THEME.ink, 0.9), 0.85);
  g.fillEllipse(x, y - 58, 60, 16);
  g.lineStyle(8, TRUNK_DEEP, 1);
  g.lineBetween(x + 24, y - 62, x + 48, y - 118);
  g.fillStyle(THEME.gold, 1);
  g.fillEllipse(x + 52, y - 126, 26, 18);
}

/** 插图里的优旃 */
function drawYousanSmall(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  roundRect(g, x - 24, y - 74, 48, 78, 18, ROBE, THEME.outline, 5);
  circle(g, x, y - 92, 20, SKIN, THEME.outline, 5);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillEllipse(x, y - 112, 34, 16);
  g.lineStyle(5, THEME.outline, 1);
  g.beginPath();
  g.arc(x, y - 86, 8, 0.3, Math.PI - 0.3);
  g.strokePath();
  g.fillStyle(THEME.paper, 1);
  g.fillEllipse(x + 44, y - 96, 44, 26);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x + 44, y - 96, 44, 26);
}