import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { TWOLINE } from '@chags/templates/twoline';
import type { TwolineStageState } from '@chags/templates';
import {
  CITY, CLIFF, FOOT_STEPS, GROUND_Y, MOON, PATH, PLANK, PLANK_CENTER, SKY_TOP, STARS, pathAt,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const NIGHT = shade(THEME.skyDeep, 0.4);
const ROCK = shade(THEME.stone, 0.66);
const ROCK_DEEP = shade(THEME.stone, 0.46);
const MOONLIGHT = 0xfff6d8;

// ---------------- 明线：崖面上那条栈道 ----------------

/** 一个修栈道的木匠：抡锤子的节奏看得见（白天修得慢，就是这一计的一半） */
function drawCarpenter(g: Phaser.GameObjects.Graphics, x: number, y: number, phase: number): void {
  groundShadow(g, x, y + 4, 74, 20, 0.2);
  roundRect(g, x - 24, y - 74, 48, 78, 20, THEME.teal, THEME.outline, 5);
  circle(g, x, y - 94, 21, 0xf6d3ae, THEME.outline, 5);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 102, 44, 18);
  // 抡起来的锤子
  const lift = Math.sin(phase * Math.PI * 2) * 22;
  g.lineStyle(8, THEME.woodDeep, 1);
  g.lineBetween(x + 16, y - 60, x + 44, y - 74 - lift);
  roundRect(g, x + 34, y - 92 - lift, 26, 20, 6, THEME.stoneDeep, THEME.outline, 4);
}

/**
 * 栈道：按 ratio 决定修到了第几块木板。
 * 一眼看得见"它在往回缩" —— 明线掉下去的时候，木板一块一块地空出来。
 */
function drawPlankRoad(
  g: Phaser.GameObjects.Graphics,
  ratio: number,
  urgent: boolean,
  exposedMs: number,
): void {
  const boardsDone = Math.max(0, Math.min(1, ratio)) * PLANK.boards;
  for (let i = 0; i < PLANK.boards; i += 1) {
    const fill = Math.max(0, Math.min(1, boardsDone - i));
    const bx = PLANK.x0 + i * PLANK.boardW;
    const by = PLANK.y;
    // 底下的支柱：先立柱，才有板
    g.lineStyle(7, shade(THEME.wood, 0.7), 0.7);
    g.lineBetween(bx + PLANK.boardW / 2, by + 12, bx + PLANK.boardW / 2, by + 92);
    if (fill <= 0) {
      // 空出来的地方留一个浅印：原来这里是有板的
      g.lineStyle(4, 0xffffff, 0.14);
      g.strokeRect(bx + 2, by - 12, PLANK.boardW - 4, 26);
      continue;
    }
    const alpha = 0.3 + 0.7 * fill;
    roundRect(g, bx + 1, by - 13, PLANK.boardW - 2, 26, 6, THEME.wood, THEME.outline, 4, alpha);
    g.lineStyle(3, shade(THEME.wood, 0.8), alpha);
    g.lineBetween(bx + 6, by, bx + PLANK.boardW - 6, by);
  }

  // 栈道尽头：修到哪儿，木匠就在哪儿
  const tipIndex = Math.max(0, Math.ceil(boardsDone) - 1);
  const tipX = PLANK.x0 + tipIndex * PLANK.boardW + PLANK.boardW / 2;
  if (boardsDone > 0.2) drawCarpenter(g, tipX, PLANK.y - 6, 0);

  // 快撑不住了：尽头闪橙光；刚被看穿：整条路红一下
  if (urgent) {
    g.fillStyle(THEME.red, 0.2);
    g.fillEllipse(tipX, PLANK.y - 10, 200, 240);
  }
  if (exposedMs < TWOLINE.exposedFlashMs) {
    g.fillStyle(THEME.red, 0.26 * (1 - exposedMs / TWOLINE.exposedFlashMs));
    g.fillEllipse(PLANK_CENTER, PLANK.y - 20, 460, 320);
  }
}

/** 夜色里一盏挂在崖上的灯：栈道这边是明面上的热闹，灯得亮着 */
function drawCliffLantern(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.lineStyle(6, shade(THEME.wood, 0.8), 1);
  g.lineBetween(x, y - 60, x, y - 16);
  g.fillStyle(MOONLIGHT, 0.22);
  g.fillCircle(x, y, 62);
  roundRect(g, x - 22, y - 18, 44, 54, 14, THEME.gold, THEME.outline, 5);
}

// ---------------- 暗线：从山脚绕上城门的小路 ----------------

/**
 * 小路上的脚印：点亮的是一步一步推上去的暗线。
 * 脚印数 = 要点几下 —— 孩子看得见"还差几步到城门"。
 */
function drawPath(
  g: Phaser.GameObjects.Graphics,
  ratio: number,
  elapsedMs: number,
): void {
  // 路本身：一条浅浅的石子带
  for (let i = 0; i < 40; i += 1) {
    const t = i / 39;
    const at = pathAt(t);
    g.fillStyle(shade(THEME.sand, 0.66), 0.32);
    g.fillEllipse(at.x, at.y, 66, 26);
  }

  const lit = Math.max(0, Math.min(1, ratio)) * FOOT_STEPS;
  for (let i = 0; i < FOOT_STEPS; i += 1) {
    const at = pathAt((i + 1) / FOOT_STEPS);
    const on = lit > i;
    if (!on) {
      // 还没走到的地方：一个浅浅的印子
      g.lineStyle(3, 0xffffff, 0.16);
      g.strokeCircle(at.x, at.y, 11);
      continue;
    }
    g.fillStyle(shade(THEME.inkSoft, 0.8), 0.75);
    g.fillEllipse(at.x - 7, at.y, 16, 11);
    g.fillEllipse(at.x + 8, at.y - 6, 16, 11);
  }

  // 走在最前面的那个人：一摇一晃地往上走
  if (lit > 0.5) {
    const head = Math.min(1, lit / FOOT_STEPS);
    const at = pathAt(head);
    const sway = Math.sin(elapsedMs / 260) * 4;
    roundRect(g, at.x - 17 + sway, at.y - 74, 34, 56, 15, THEME.tealDeep, THEME.outline, 5);
    circle(g, at.x + sway, at.y - 88, 16, 0xf6d3ae, THEME.outline, 4);
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(at.x + sway, at.y - 95, 34, 14);
  }
}

// ---------------- 远处的陈仓城 ----------------

function drawCity(g: Phaser.GameObjects.Graphics, lit: boolean): void {
  const { x, y, w, h } = CITY;
  roundRect(g, x, y, w, h, 18, ROCK, THEME.outline, 6);
  // 城垛
  for (let i = 0; i < 5; i += 1) {
    roundRect(g, x + 18 + i * ((w - 36) / 5), y - 26, (w - 36) / 5 - 12, 30, 8, ROCK_DEEP, THEME.outline, 5);
  }
  // 城楼
  roundRect(g, x + w * 0.28, y - 96, w * 0.44, 74, 16, shade(THEME.redDeep, 0.8), THEME.outline, 6);
  g.fillStyle(THEME.gold, lit ? 0.95 : 0.6);
  g.fillTriangle(x + w * 0.24, y - 96, x + w * 0.76, y - 96, x + w * 0.5, y - 148);
  // 城门：暗线走到头，门就亮起来
  roundRect(g, x + w * 0.42, y + h - 84, w * 0.16, 84, 12, lit ? THEME.gold : shade(THEME.ink, 0.9), THEME.outline, 5);
  if (lit) {
    g.fillStyle(THEME.gold, 0.28);
    g.fillEllipse(x + w * 0.5, y + h - 40, w * 0.9, 300);
  }
}

// ---------------- 景 ----------------

/** 这个世界：夜空、月亮、左边的崖与崖上的栈道、右边上山的小路、远处的陈仓 */
export function drawWorld(g: Phaser.GameObjects.Graphics): void {
  // 标题条（0..150）留给 BaseScene 的 drawBackdrop：夜从它下面开始
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  for (const star of STARS) {
    g.fillStyle(MOONLIGHT, 0.85);
    g.fillCircle(star.x, star.y, 3.5);
  }
  g.fillStyle(MOONLIGHT, 0.14);
  g.fillCircle(MOON.x, MOON.y, MOON.r + 34);
  circle(g, MOON.x, MOON.y, MOON.r, MOONLIGHT, null, 0);

  // 远处的山脊
  g.fillStyle(shade(THEME.tealDeep, 0.6), 0.8);
  g.fillTriangle(120, GROUND_Y, 420, 560, 700, GROUND_Y);
  g.fillStyle(shade(THEME.tealDeep, 0.45), 0.85);
  g.fillTriangle(360, GROUND_Y, 620, 640, 900, GROUND_Y);

  // 地面
  g.fillStyle(shade(THEME.stoneDeep, 0.42), 1);
  g.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // 左边那面崖
  g.fillStyle(ROCK_DEEP, 1);
  g.fillRect(CLIFF.left, CLIFF.top, CLIFF.right - CLIFF.left, CLIFF.bottom - CLIFF.top);
  g.fillStyle(ROCK, 1);
  g.fillRect(CLIFF.left + 18, CLIFF.top + 12, CLIFF.right - CLIFF.left - 60, CLIFF.bottom - CLIFF.top - 60);
  g.lineStyle(5, shade(THEME.stone, 0.52), 0.8);
  for (let y = CLIFF.top + 90; y < CLIFF.bottom - 40; y += 120) {
    g.lineBetween(CLIFF.left + 30, y, CLIFF.right - 60, y - 26);
  }
  // 栈道底下那几根长支柱（修在崖上，才叫栈道）
  g.lineStyle(9, shade(THEME.wood, 0.66), 0.9);
  for (const bx of [PLANK.x0 + 20, PLANK_CENTER, PLANK.x0 + PLANK.boardW * PLANK.boards - 20]) {
    g.lineBetween(bx, PLANK.y + 20, bx - 34, PLANK.y + 170);
  }
  drawCliffLantern(g, PLANK.x0 - 46, PLANK.y - 150);

  // 小路
  for (let i = 0; i < 40; i += 1) {
    const at = pathAt(i / 39);
    g.fillStyle(shade(THEME.sand, 0.7), 0.24);
    g.fillEllipse(at.x, at.y, 78, 30);
  }
  // 山脚那块指路的石头
  roundRect(g, PATH.x - 150, PATH.bottomY - 40, 84, 96, 16, ROCK, THEME.outline, 6);

  drawCity(g, false);

  // 明线上那盏灯先亮着（修栈道是明面上的事）
  g.fillStyle(THEME.gold, 0.12);
  g.fillEllipse(PLANK_CENTER, PLANK.y - 70, 520, 340);
}

/** 每帧：栈道修到哪儿了、小路上走到哪儿了、被看穿的红光 */
export function drawStage(g: Phaser.GameObjects.Graphics, state: TwolineStageState): void {
  drawPlankRoad(g, state.decoyRatio, state.decoyUrgent, state.sinceExposedMs);
  drawPath(g, state.realRatio, state.elapsedMs);
  if (state.realRatio >= 1) drawCity(g, true);

  // 两边各一条细进度：数字看不见，长短看得见
  const barW = 240;
  const dy = PLANK.y + 150;
  roundRect(g, PLANK_CENTER - barW / 2, dy, barW, 22, 11, shade(THEME.card, 0.6), THEME.outline, 4);
  const dfill = barW * Math.max(0, Math.min(1, state.decoyRatio));
  if (dfill > 4) {
    roundRect(g, PLANK_CENTER - barW / 2 + 2, dy + 2, dfill - 4, 18, 9, state.decoyUrgent ? THEME.red : THEME.gold, null, 0);
  }
  const ry = PATH.bottomY + 96;
  roundRect(g, PATH.x - barW / 2, ry, barW, 22, 11, shade(THEME.card, 0.6), THEME.outline, 4);
  const rfill = barW * Math.max(0, Math.min(1, state.realRatio));
  if (rfill > 4) {
    roundRect(g, PATH.x - barW / 2 + 2, ry + 2, rfill - 4, 18, 9, THEME.teal, null, 0);
  }

  if (state.done) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse(W / 2, H / 2, 1000, 1000);
  }
}

/** 收尾：栈道还撑着，小路已经走到城门里 —— 两件事一起做成了 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.2);
  g.fillEllipse(CITY.x + CITY.w / 2, CITY.y + CITY.h, 900, 700);
  drawCity(g, true);
  drawPlankRoad(g, 1, false, 0);
  for (let i = 0; i < 40; i += 1) {
    const at = pathAt(i / 39);
    g.fillStyle(shade(THEME.inkSoft, 0.8), 0.6);
    g.fillEllipse(at.x - 7, at.y, 16, 11);
    g.fillEllipse(at.x + 8, at.y - 6, 16, 11);
  }
}

// ---------------- 分幕插图 ----------------

/** 插图里的崖与栈道（比正片小一号，按插图矩形自己算） */
function drawBeatRoad(
  g: Phaser.GameObjects.Graphics,
  left: number,
  right: number,
  y: number,
  boards: number,
  done: boolean,
): void {
  for (let i = 0; i < boards; i += 1) {
    const bw = (right - left) / boards;
    const bx = left + i * bw;
    g.lineStyle(4, shade(THEME.wood, 0.7), 0.8);
    g.lineBetween(bx + bw / 2, y + 8, bx + bw / 2, y + 54);
    if (done || i < boards - 2) {
      roundRect(g, bx + 2, y - 10, bw - 4, 20, 5, THEME.wood, THEME.outline, 4);
    }
  }
}

/**
 * 分幕插图：① 明面上叮叮当当地修栈道 ② 夜里从小路进了陈仓
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  // ① 是白天，② 是夜里 —— 一明一暗，正是这一计的两半
  const day = index === 0;
  g.fillStyle(day ? THEME.sky : NIGHT, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  if (!day) {
    for (const star of STARS) {
      g.fillStyle(MOONLIGHT, 0.8);
      g.fillCircle(x + (star.x / W) * w, y + (star.y / H) * h, 3);
    }
    g.fillStyle(MOONLIGHT, 0.16);
    g.fillCircle(x + w * 0.82, y + h * 0.14, 62);
    circle(g, x + w * 0.82, y + h * 0.14, 40, MOONLIGHT, null, 0);
  } else {
    g.fillStyle(THEME.gold, 0.5);
    g.fillCircle(x + w * 0.82, y + h * 0.14, 42);
  }

  const groundY = y + h * 0.82;
  g.fillStyle(day ? shade(THEME.sand, 0.9) : shade(THEME.stoneDeep, 0.44), 1);
  g.fillRoundedRect(x - 20, groundY, w + 40, h * 0.24, 24);

  if (index === 0) {
    // ① 崖上修栈道：木板一块一块钉，两个木匠抡着锤子
    g.fillStyle(ROCK_DEEP, 1);
    g.fillRoundedRect(x + w * 0.06, y + h * 0.18, w * 0.52, h * 0.66, 22);
    drawBeatRoad(g, x + w * 0.12, x + w * 0.86, y + h * 0.52, 7, false);
    drawCarpenter(g, x + w * 0.68, y + h * 0.54, 0);
    drawCarpenter(g, x + w * 0.34, y + h * 0.54, 0.5);
    return;
  }

  // ② 夜里的小路：一串人举着灯，悄悄往上走
  const startX = x + w * 0.16;
  const startY = groundY - 10;
  const endX = x + w * 0.7;
  const endY = y + h * 0.36;
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    g.fillStyle(shade(THEME.sand, 0.7), 0.3);
    g.fillEllipse(startX + (endX - startX) * t, startY + (endY - startY) * t, 62, 24);
  }
  for (let i = 0; i < 4; i += 1) {
    const t = 0.1 + i * 0.22;
    const px = startX + (endX - startX) * t;
    const py = startY + (endY - startY) * t;
    roundRect(g, px - 15, py - 64, 30, 50, 13, THEME.tealDeep, THEME.outline, 5);
    circle(g, px, py - 78, 15, 0xf6d3ae, THEME.outline, 4);
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(px, py - 84, 32, 13);
    g.fillStyle(THEME.gold, 0.9);
    g.fillCircle(px + 22, py - 40, 9);
    g.fillStyle(MOONLIGHT, 0.16 + i * 0.02);
    g.fillCircle(px + 22, py - 40, 40);
  }
  // 远处的城门亮着一条缝
  roundRect(g, x + w * 0.74, y + h * 0.26, w * 0.2, h * 0.3, 14, ROCK, THEME.outline, 5);
  roundRect(g, x + w * 0.8, y + h * 0.42, w * 0.08, h * 0.14, 8, THEME.gold, THEME.outline, 4);
}
