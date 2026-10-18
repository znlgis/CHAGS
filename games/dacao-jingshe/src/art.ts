import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { PROBE } from '@chags/templates/probe';
import type { ProbeStageState } from '@chags/templates';
import type { ProbeLevel, ProbePatch } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';
import {
  EXIT, GROUND_TOP, LANTERNS, PATCHES, PATCH_RADIUS, POLE_LEN, ROAD, WALKER, YARD_TOP,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const GRASS = THEME.leaf;
const GRASS_DEEP = shade(THEME.leaf, 0.64);
const SNAKE = THEME.tealDeep;
const SKIN = 0xf8dcbb;


// ---------------- 景（画一次） ----------------

/** 院墙、灯笼、后院的地、一条小路，以及右边的院门 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: ProbeLevel): void {
  if (level.mode !== 'knock') return;

  // 墙外的天
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  // 院墙
  g.fillStyle(shade(THEME.paper, 0.95), 1);
  g.fillRect(0, GROUND_TOP, W, YARD_TOP - GROUND_TOP);
  g.lineStyle(4, shade(THEME.paperDeep, 0.92), 1);
  for (let y = GROUND_TOP + 60; y < YARD_TOP - 40; y += 74) g.lineBetween(10, y, W - 10, y);
  // 墙头的瓦
  g.fillStyle(THEME.inkSoft, 1);
  g.fillRect(0, YARD_TOP - 44, W, 44);
  g.fillStyle(shade(THEME.inkSoft, 0.7), 1);
  for (let x = 22; x < W; x += 58) g.fillCircle(x, YARD_TOP - 44, 13);
  // 两只灯笼
  for (const lantern of LANTERNS) {
    g.lineStyle(6, THEME.inkSoft, 1);
    g.lineBetween(lantern.x, lantern.y - 96, lantern.x, lantern.y - 40);
    g.fillStyle(THEME.red, 1);
    g.fillEllipse(lantern.x, lantern.y, 62, 84);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeEllipse(lantern.x, lantern.y, 62, 84);
    g.lineStyle(5, THEME.goldDeep, 1);
    g.lineBetween(lantern.x - 31, lantern.y, lantern.x + 31, lantern.y);
  }

  // 后院的地
  g.fillStyle(THEME.sand, 1);
  g.fillRect(0, YARD_TOP, W, H - YARD_TOP);
  g.fillStyle(shade(THEME.sandDeep, 1.02), 1);
  g.fillEllipse(W * 0.3, 760, 620, 220);
  g.fillEllipse(W * 0.8, 1080, 460, 260);
  // 墙根的一排矮草（纯装饰，不是草丛）
  for (let x = 24; x < W; x += 46) {
    g.lineStyle(5, GRASS_DEEP, 0.55);
    g.lineBetween(x, YARD_TOP + 16, x - 10, YARD_TOP - 10);
    g.lineBetween(x, YARD_TOP + 16, x + 12, YARD_TOP - 16);
  }

  // 小路：从王鲁脚下斜着通到院门
  const { from, to, width } = ROAD;
  g.lineStyle(width, shade(THEME.sandDeep, 0.98), 1);
  g.lineBetween(from.x, from.y, to.x, to.y);
  g.lineStyle(width * 0.52, shade(THEME.paperDeep, 1.0), 1);
  g.lineBetween(from.x, from.y, to.x, to.y);
  // 路上的碎石
  const stones = [
    { x: 150, y: 1130 }, { x: 300, y: 1046 }, { x: 452, y: 964 }, { x: 588, y: 878 }, { x: 660, y: 762 },
  ];
  for (const stone of stones) {
    circle(g, stone.x, stone.y, 13, THEME.stone, THEME.outline, 5);
  }

  drawGate(g, level.exit);
}

/**
 * 院门（exit）：走过这一丛，从这儿出去。
 * 门比 exit 的圈略小一点，整扇门都留在画面里（设计宽度 750，门在最右边）。
 */
function drawGate(g: Phaser.GameObjects.Graphics, exit: { x: number; y: number }): void {
  const w = 92;
  const h = 176;
  roundRect(g, exit.x - w / 2 - 10, exit.y - h / 2 - 30, w + 20, 32, 12, THEME.redDeep, THEME.outline, 6);
  roundRect(g, exit.x - w / 2, exit.y - h / 2, w, h, 12, THEME.wood, THEME.outline, 7);
  roundRect(g, exit.x - w / 2 + 9, exit.y - h / 2 + 12, w / 2 - 12, h - 24, 7, shade(THEME.wood, 0.84), THEME.outline, 5);
  roundRect(g, exit.x + 3, exit.y - h / 2 + 12, w / 2 - 12, h - 24, 7, shade(THEME.wood, 0.84), THEME.outline, 5);
  circle(g, exit.x - 11, exit.y + 4, 8, THEME.gold, THEME.outline, 4);
  circle(g, exit.x + 11, exit.y + 4, 8, THEME.gold, THEME.outline, 4);
}

// ---------------- 草丛 ----------------

/** 一丛草里探出来的蛇：敲到它的那一下才窜出来（之前谁都一样） */
function drawSnake(g: Phaser.GameObjects.Graphics, patch: ProbePatch, state: ProbeStageState): void {
  const rising = state.lastSnake === patch ? clamp01((state.elapsedMs - state.lastSnakeAtMs) / 240) : 1;
  const bob = Math.sin(state.elapsedMs / 170) * 4;
  const headX = patch.x + 30;
  const headY = patch.y - 6 - 52 * rising + bob;

  g.lineStyle(20, SNAKE, 1);
  g.beginPath();
  g.moveTo(patch.x - 44, patch.y + 26);
  g.lineTo(patch.x - 14, patch.y + 4);
  g.lineTo(patch.x + 10, patch.y + 16);
  g.lineTo(headX - 8, headY + 20);
  g.strokePath();

  circle(g, headX, headY + 10, 23, SNAKE, THEME.outline, 6);
  g.fillStyle(THEME.paper, 1);
  g.fillCircle(headX - 6, headY + 2, 7);
  g.fillCircle(headX + 10, headY + 2, 7);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(headX - 5, headY + 3, 3);
  g.fillCircle(headX + 11, headY + 3, 3);
  g.lineStyle(5, THEME.red, 1);
  g.lineBetween(headX + 20, headY + 14, headX + 40, headY + 4);
  g.lineBetween(headX + 20, headY + 14, headX + 40, headY + 24);
}

/** "这一丛看过了，没有蛇"：一枚金色的小勾 */
function drawSafeCheck(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void {
  const pulse = 0.86 + 0.14 * Math.sin(t / 210);
  circle(g, x, y, 26 * pulse, THEME.paper, THEME.outline, 5);
  g.lineStyle(10, THEME.goldDeep, 1);
  g.beginPath();
  g.moveTo(x - 12, y);
  g.lineTo(x - 3, y + 11);
  g.lineTo(x + 14, y - 12);
  g.strokePath();
}

/** 一丛草此刻的样子：完好的、被搅乱的、确认安全的（有蛇的只在这个时刻露头） */
function drawBush(g: Phaser.GameObjects.Graphics, patch: ProbePatch, state: ProbeStageState): void {
  const r = PATCH_RADIUS;
  const knocked = state.knocked.includes(patch.id);

  if (state.spooked.includes(patch.id)) {
    // 被搅乱的那几丛：矮下去、颜色发暗，草叶散在一边 —— "这里不能走了"
    groundShadow(g, patch.x, patch.y + r * 0.4, r * 1.9, r * 0.56, 0.14);
    g.fillStyle(GRASS_DEEP, 1);
    g.fillEllipse(patch.x, patch.y + r * 0.26, r * 1.94, r * 0.7);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeEllipse(patch.x, patch.y + r * 0.26, r * 1.94, r * 0.7);
    for (let i = 0; i < 5; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const sx = patch.x + side * (r * 0.6 + i * 9);
      g.lineStyle(6, GRASS_DEEP, 0.95);
      g.lineBetween(sx, patch.y + r * 0.4, sx + side * 34, patch.y + r * 0.86);
    }
    return;
  }

  // 完好的草丛：三团草叠起来，每一丛长得一模一样
  groundShadow(g, patch.x, patch.y + r * 0.46, r * 1.86, r * 0.6, 0.16);
  g.fillStyle(GRASS, 1);
  g.fillEllipse(patch.x - r * 0.5, patch.y + r * 0.1, r * 1.5, r * 1.3);
  g.fillEllipse(patch.x + r * 0.5, patch.y + r * 0.1, r * 1.5, r * 1.3);
  g.fillEllipse(patch.x, patch.y - r * 0.34, r * 1.6, r * 1.5);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(patch.x - r * 0.5, patch.y + r * 0.1, r * 1.5, r * 1.3);
  g.strokeEllipse(patch.x + r * 0.5, patch.y + r * 0.1, r * 1.5, r * 1.3);
  g.strokeEllipse(patch.x, patch.y - r * 0.34, r * 1.6, r * 1.5);
  // 顶上几根草叶，风一吹歪一下
  const sway = Math.sin(state.elapsedMs / 420 + patch.x) * 4;
  for (let i = 0; i < 6; i += 1) {
    const bx = patch.x - r * 0.66 + i * (r * 0.26);
    g.lineStyle(6, shade(GRASS, 0.82), 1);
    g.lineBetween(bx, patch.y - r * 0.5, bx + sway + (i - 2.5) * 5, patch.y - r * 1.12);
  }

  if (knocked && patch.has === 'snake') drawSnake(g, patch, state);
  if (state.landable.includes(patch.id)) {
    drawSafeCheck(g, patch.x, patch.y - r - 34, state.elapsedMs);
  }
}

// ---------------- 王鲁 ----------------

/** 他站在哪儿：没走过去就在小路这一头，走过去就先到那一丛、再到院门 */
function walkerPos(state: ProbeStageState): { x: number; y: number } {
  if (state.crossedAtMs < 0 || state.crossed === null) return { x: WALKER.x, y: WALKER.y };
  const patch = PATCHES.find((item) => item.id === state.crossed);
  if (patch === undefined) return { x: WALKER.x, y: WALKER.y };
  const t = clamp01((state.elapsedMs - state.crossedAtMs) / (PROBE.crossMs * 2));
  if (t <= 0.5) {
    const p = t / 0.5;
    return { x: WALKER.x + (patch.x - WALKER.x) * p, y: WALKER.y + (patch.y - WALKER.y) * p };
  }
  const p = (t - 0.5) / 0.5;
  return { x: patch.x + (EXIT.x - patch.x) * p, y: patch.y + (EXIT.y - patch.y) * p };
}

/** 竹竿往哪儿指：平时斜举着，敲下去的那一下朝草丛点一点 */
function poleTip(state: ProbeStageState, pos: { x: number; y: number }): { x: number; y: number } {
  const handX = pos.x + 22;
  const handY = pos.y - 58;
  let angle = -Math.PI / 2 + 0.34;
  const patch = state.lastKnock;
  if (patch !== null) {
    const since = state.elapsedMs - state.lastKnockAtMs;
    if (since >= 0 && since <= PROBE.knockMs * 2) {
      const swing = Math.sin((Math.PI * since) / (PROBE.knockMs * 2));
      const towards = Math.atan2(patch.y - handY, patch.x - handX);
      angle += (towards - angle) * swing;
    }
  }
  return { x: handX + Math.cos(angle) * POLE_LEN, y: handY + Math.sin(angle) * POLE_LEN };
}

/** 王鲁：一件袍子、一顶幞头、一根竹竿 */
function drawWalker(g: Phaser.GameObjects.Graphics, state: ProbeStageState): void {
  const pos = walkerPos(state);
  const walking = state.crossed !== null && clamp01((state.elapsedMs - state.crossedAtMs) / (PROBE.crossMs * 2)) < 1;
  const bob = walking ? Math.abs(Math.sin(state.elapsedMs / 110)) * 6 : 0;
  const y = pos.y - bob;

  groundShadow(g, pos.x, pos.y + 8, 116, 32, 0.2);
  // 袍子
  roundRect(g, pos.x - 36, y - 100, 72, 104, 22, shade(THEME.teal, 0.96), THEME.outline, 6);
  g.lineStyle(9, THEME.redDeep, 1);
  g.lineBetween(pos.x - 36, y - 54, pos.x + 36, y - 54);
  // 两条腿
  g.lineStyle(12, THEME.outline, 1);
  g.lineBetween(pos.x - 14, y + 2, pos.x - 14 - (walking ? 8 : 0), y + 22);
  g.lineBetween(pos.x + 14, y + 2, pos.x + 14 + (walking ? 8 : 0), y + 22);
  // 头与幞头
  circle(g, pos.x, y - 128, 27, SKIN, THEME.outline, 6);
  circle(g, pos.x, y - 152, 24, THEME.inkSoft, THEME.outline, 6);
  roundRect(g, pos.x - 40, y - 148, 80, 16, 8, THEME.inkSoft, THEME.outline, 5);
  // 竹竿与手
  const tip = poleTip(state, pos);
  g.lineStyle(9, THEME.wood, 1);
  g.lineBetween(pos.x + 22, y - 58, tip.x, tip.y);
  g.lineStyle(5, shade(THEME.wood, 0.8), 1);
  g.lineBetween(pos.x + 22, y - 58, tip.x, tip.y);
  circle(g, pos.x + 24, y - 56, 13, SKIN, THEME.outline, 5);
}

// ---------------- 每帧 ----------------

/** 每帧：五丛草（谁被搅乱了、谁确认安全了），以及拿着竹竿的王鲁 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: ProbeStageState,
  level: ProbeLevel,
): void {
  if (level.mode !== 'knock') return;
  for (const patch of level.patches) drawBush(g, patch, state);
  drawWalker(g, state);
}

/** 收尾：确认安全的那一丛到院门之间，一条走得通的金光 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: ProbeStageState,
  level: ProbeLevel,
): void {
  if (level.mode !== 'knock') return;
  const patch = PATCHES.find((item) => item.id === state.crossed) ?? PATCHES[PATCHES.length - 1]!;
  g.lineStyle(28, THEME.gold, 0.34);
  g.lineBetween(patch.x, patch.y, level.exit.x, level.exit.y);
  g.fillStyle(THEME.gold, 0.2);
  g.fillCircle(level.exit.x, level.exit.y, 150);
  g.lineStyle(9, THEME.gold, 0.6);
  g.strokeCircle(level.exit.x, level.exit.y, 124);
}

// ---------------- 分幕插图 ----------------

/** 插图里的一个人（比正片小一号，位置按插图自己的矩形算） */
function drawBeatPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  robe: number,
): void {
  roundRect(g, x - 26 * scale, y - 74 * scale, 52 * scale, 78 * scale, 18 * scale, robe, THEME.outline, 5);
  circle(g, x, y - 96 * scale, 20 * scale, SKIN, THEME.outline, 5);
  circle(g, x, y - 114 * scale, 17 * scale, THEME.inkSoft, THEME.outline, 5);
  groundShadow(g, x, y + 6 * scale, 76 * scale, 20 * scale, 0.16);
}

/** 分幕插图：① 案卷上出现了自己的名字 ② 竹竿拨草，蛇一窜，全院子都知道了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillRoundedRect(x, y + h * 0.62, w, h * 0.38, 30);
  g.lineStyle(4, shade(THEME.paperDeep, 0.9), 1);
  g.lineBetween(x + 30, y + h * 0.62, x + w - 30, y + h * 0.62);

  if (index === 0) {
    // ① 案几上一卷摊开的状纸，末尾那个名字被红圈圈住
    roundRect(g, x + w * 0.08, y + h * 0.56, w * 0.84, h * 0.12, 14, THEME.wood, THEME.outline, 6);
    roundRect(g, x + w * 0.16, y + h * 0.34, w * 0.52, h * 0.26, 10, THEME.paper, THEME.outline, 5);
    for (let i = 0; i < 4; i += 1) {
      const ly = y + h * 0.39 + i * h * 0.045;
      g.lineStyle(6, THEME.inkSoft, 0.7);
      g.lineBetween(x + w * 0.21, ly, x + w * 0.5 - i * 26, ly);
    }
    g.lineStyle(7, THEME.red, 0.95);
    g.strokeCircle(x + w * 0.58, y + h * 0.51, 30);
    // 灯与俯身的人
    circle(g, x + w * 0.86, y + h * 0.3, 26, THEME.gold, THEME.outline, 6);
    g.lineStyle(6, THEME.inkSoft, 1);
    g.lineBetween(x + w * 0.86, y + h * 0.18, x + w * 0.86, y + h * 0.26);
    drawBeatPerson(g, x + w * 0.86, y + h * 0.58, 1, shade(THEME.teal, 0.96));
    // 一滴冷汗
    circle(g, x + w * 0.79, y + h * 0.4, 8, THEME.sky, THEME.outline, 4);
    return;
  }

  // ② 一地草丛：竹竿拨开一处，蛇窜出来，院墙上探出几个脑袋
  for (let i = 0; i < 5; i += 1) {
    const bx = x + w * 0.16 + i * w * 0.17;
    const by = y + h * 0.66 + Math.sin(i) * 14;
    g.fillStyle(GRASS, 1);
    g.fillEllipse(bx, by, 108, 78);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeEllipse(bx, by, 108, 78);
  }
  drawBeatPerson(g, x + w * 0.2, y + h * 0.66, 1, shade(THEME.teal, 0.96));
  // 竹竿指过去
  g.lineStyle(8, THEME.wood, 1);
  g.lineBetween(x + w * 0.24, y + h * 0.5, x + w * 0.62, y + h * 0.58);
  // 窜出来的蛇
  g.lineStyle(16, SNAKE, 1);
  g.beginPath();
  g.moveTo(x + w * 0.66, y + h * 0.66);
  g.lineTo(x + w * 0.72, y + h * 0.5);
  g.lineTo(x + w * 0.62, y + h * 0.42);
  g.strokePath();
  circle(g, x + w * 0.6, y + h * 0.4, 20, SNAKE, THEME.outline, 5);
  g.fillStyle(THEME.paper, 1);
  g.fillCircle(x + w * 0.57, y + h * 0.38, 6);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + w * 0.57, y + h * 0.38, 3);
  g.lineStyle(5, THEME.red, 1);
  g.lineBetween(x + w * 0.56, y + h * 0.43, x + w * 0.5, y + h * 0.45);
  // 院子里探头的几个人（"全院子都知道了"）
  for (let i = 0; i < 4; i += 1) {
    const px = x + w * 0.2 + i * w * 0.2;
    const py = y + h * 0.22 + (i % 2) * 16;
    circle(g, px, py, 22, SKIN, THEME.outline, 5);
    circle(g, px, py - 20, 18, THEME.inkSoft, THEME.outline, 5);
    g.fillStyle(THEME.outline, 1);
    g.fillCircle(px - 6, py - 2, 3);
    g.fillCircle(px + 6, py - 2, 3);
  }
}
