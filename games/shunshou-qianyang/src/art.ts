import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { WindowStageState } from '@chags/templates';
import type { WindowJob } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';

/**
 * 顺手牵羊：雪夜赶路。
 *
 * 画面只有一条**巡道** —— 队伍沿着它一圈一圈地走，路上每隔一轮路过一件机会
 * （走散的羊 / 一捆柴 / 一个水囊）。机会只在窗口里出现在路边，窗口一过就落在队伍后面；
 * 抓到的摆回营门口的木架上，没抓够就再走一趟。
 *
 * 三件机会的坐标写在关卡数据里（jobs），与下面的路形一一对应：
 * 180° = 左手边、300° = 右上、60° = 右下。
 * 判定全在模板的 window.logic 里，这里只按 state 画。
 */

const W = DESIGN.width;
const H = DESIGN.height;
/** 标题条以下才是画面 */
const TOP = 150;

const NIGHT = 0x1b2740;
const NIGHT_MID = 0x24334f;
const NIGHT_DEEP = 0x121a2c;
const SNOW = 0xe8f0f8;
const SNOW_DEEP = 0xccdcec;
const ROAD_FILL = 0xb6c6da;
const ROAD_EDGE = 0x8ea2ba;
const CLOTH = 0x8b97ad;
const CLOTH_DEEP = 0x6b7691;
const SKIN = 0xf6d3ae;
const FIRE = 0xf2a03c;

/** 巡道：一条绕着营地转的路 */
export const ROAD = { cx: 375, cy: 960, rx: 270, ry: 180, width: 66 } as const;

/** 三件机会在路上的角度（度；屏幕 y 向下）：左手边 / 右上 / 右下 */
export const SPOT_DEG = [180, 300, 60] as const;

/** 一趟的起点 = 第一轮那件机会的前一段（就是营门口那一段路） */
export const START_DEG = SPOT_DEG[2]!;

export type OpportunityKind = 'sheep' | 'wood' | 'skin';
const KINDS: readonly OpportunityKind[] = ['sheep', 'wood', 'skin'];


/** 这一点在路上哪儿 */
export function roadPoint(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: ROAD.cx + ROAD.rx * Math.cos(rad), y: ROAD.cy + ROAD.ry * Math.sin(rad) };
}

/**
 * 队伍此刻走在路上的哪一度：一段 360/n 度，匀速走完，
 * **正好在窗口打开时走到这一轮那件机会跟前** —— 窗口里就站着不动，抓紧抓。
 */
export function squadDeg(state: WindowStageState, jobs: WindowJob[]): number {
  const n = Math.max(1, jobs.length);
  if (state.restarting) return START_DEG;
  const index = ((state.round % n) + n) % n;
  const leg = 360 / n;
  const arrive = SPOT_DEG[index % SPOT_DEG.length]! + 360 * Math.floor(state.round / n);
  const from = arrive - leg;
  const u = state.phase === 'window' ? 1 : clamp01(state.progress);
  return from + leg * u;
}

export function kindOf(job: WindowJob, index: number): OpportunityKind {
  if (job.id === 'sheep' || job.id === 'wood' || job.id === 'skin') return job.id;
  return KINDS[index % KINDS.length]!;
}

// ---------------- 夜、城、雪地 ----------------

function sky(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(0, TOP, W, 250);
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, TOP + 250, W, 300);
  g.fillStyle(NIGHT_MID, 1);
  g.fillRect(0, TOP + 550, W, 240);
  circle(g, 610, 268, 76, THEME.paper, null, 0, 0.12);
  circle(g, 610, 268, 52, 0xfff3d4, null, 0, 0.95);
  for (const [sx, sy, sr] of [[92, 226, 4], [220, 300, 3], [330, 210, 4], [452, 268, 3], [700, 210, 3], [150, 396, 3], [520, 372, 3]] as const) {
    g.fillStyle(THEME.paper, 0.45 + 0.35 * Math.sin(t / 700 + sx));
    g.fillCircle(sx, sy, sr);
  }
}

/** 远处的蔡州城：这一趟要去的地方（有灯火，但城很小很远） */
function city(g: Phaser.GameObjects.Graphics): void {
  const base = 690;
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(120, base - 150, 510, 150);
  g.fillRect(160, base - 224, 92, 90);
  g.fillRect(500, base - 224, 92, 90);
  g.fillTriangle(150, base - 224, 206, base - 280, 262, base - 224);
  g.fillTriangle(490, base - 224, 546, base - 280, 602, base - 224);
  g.lineStyle(5, 0x2c3a56, 0.8);
  for (let x = 140; x < 600; x += 60) g.strokeRect(x, base - 176, 34, 30);
  for (const [fx, fy] of [[206, base - 190], [546, base - 190], [375, base - 158]] as const) {
    g.fillStyle(FIRE, 0.5);
    g.fillCircle(fx, fy, 15);
    g.fillStyle(0xffd08a, 0.9);
    g.fillCircle(fx, fy, 7);
  }
}

function snowField(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SNOW, 1);
  g.fillRect(0, 700, W, H - 700);
  g.fillStyle(SNOW_DEEP, 0.6);
  g.fillRect(0, 700, W, 34);
  g.fillStyle(0xf3f8fd, 1);
  g.fillEllipse(120, 762, 460, 130);
  g.fillEllipse(620, 740, 420, 110);
}

function road(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(ROAD.width, ROAD_FILL, 1);
  g.strokeEllipse(ROAD.cx, ROAD.cy, ROAD.rx * 2, ROAD.ry * 2);
  g.lineStyle(6, ROAD_EDGE, 0.7);
  g.strokeEllipse(ROAD.cx, ROAD.cy, ROAD.rx * 2 + ROAD.width, ROAD.ry * 2 + ROAD.width * 0.62);
  g.strokeEllipse(ROAD.cx, ROAD.cy, ROAD.rx * 2 - ROAD.width, ROAD.ry * 2 - ROAD.width * 0.62);
  g.lineStyle(14, 0xffffff, 0.45);
  g.strokeEllipse(ROAD.cx, ROAD.cy, ROAD.rx * 2 - 16, ROAD.ry * 2 - 12);
}

/** 营门口：一趟从这里出发（第一轮那件机会的前一段路） */
function campGate(g: Phaser.GameObjects.Graphics): void {
  const { x, y } = roadPoint(START_DEG);
  g.lineStyle(13, THEME.woodDeep, 1);
  g.lineBetween(x - 52, y + 30, x - 52, y - 104);
  g.lineBetween(x + 52, y + 30, x + 52, y - 104);
  g.lineBetween(x - 66, y - 104, x + 66, y - 104);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x - 62, y - 112, x - 62, y - 78, x - 6, y - 95);
}

// ---------------- 营地（路中间） ----------------

function tent(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  groundShadow(g, x, y + 42 * s, 170 * s, 34 * s, 0.18);
  g.fillStyle(THEME.paperDeep, 1);
  g.beginPath();
  g.moveTo(x - 82 * s, y + 40 * s);
  g.lineTo(x, y - 84 * s);
  g.lineTo(x + 82 * s, y + 40 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(NIGHT_DEEP, 0.85);
  g.beginPath();
  g.moveTo(x - 22 * s, y + 40 * s);
  g.lineTo(x, y - 8 * s);
  g.lineTo(x + 22 * s, y + 40 * s);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xffffff, 0.8);
  g.beginPath();
  g.moveTo(x - 26 * s, y - 38 * s);
  g.lineTo(x, y - 86 * s);
  g.lineTo(x + 26 * s, y - 38 * s);
  g.closePath();
  g.fillPath();
}

function campBanner(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, t: number): void {
  const sway = Math.sin(t / 420) * 5 * s;
  g.lineStyle(9 * s, THEME.woodDeep, 1);
  g.lineBetween(x, y + 96 * s, x, y - 96 * s);
  g.fillStyle(THEME.red, 1);
  g.beginPath();
  g.moveTo(x + 4 * s, y - 96 * s);
  g.lineTo(x + 84 * s + sway, y - 76 * s);
  g.lineTo(x + 62 * s + sway, y - 30 * s);
  g.lineTo(x + 4 * s, y - 40 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokePath();
}

function campFire(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void {
  g.fillStyle(THEME.outline, 0.22);
  g.fillEllipse(x, y + 8, 120, 34);
  g.lineStyle(11, THEME.woodDeep, 1);
  g.lineBetween(x - 42, y + 2, x + 42, y + 14);
  g.lineBetween(x - 42, y + 14, x + 42, y + 2);
  const flick = 0.85 + 0.15 * Math.sin(t / 110);
  g.fillStyle(FIRE, 0.14);
  g.fillCircle(x, y - 8, 108);
  g.fillStyle(FIRE, 0.9);
  g.fillTriangle(x - 26, y + 6, x + 26, y + 6, x + Math.sin(t / 90) * 8, y - 72 * flick);
  g.fillStyle(0xffd08a, 0.95);
  g.fillTriangle(x - 13, y + 6, x + 13, y + 6, x + Math.sin(t / 80) * 6, y - 42 * flick);
}

function camp(g: Phaser.GameObjects.Graphics, t: number): void {
  tent(g, 286, 906, 0.72);
  tent(g, 464, 916, 0.64);
  campBanner(g, 375, 884, 0.7, t);
  campFire(g, 375, 1024, t);
}

// ---------------- 三件机会 ----------------

/** 走散的羊：一团羊毛、两只耳朵、一个小铃铛（是走散的那只，不是别人的） */
function drawSheep(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha: number): void {
  groundShadow(g, x, y + 40 * s, 150 * s, 34 * s, 0.16 * alpha);
  g.lineStyle(11 * s, shade(THEME.paper, 0.84), alpha);
  for (const dx of [-38, -14, 14, 38]) {
    g.lineBetween(x + dx * s, y + 6 * s, x + dx * s, y + 40 * s);
  }
  circle(g, x, y - 8 * s, 48 * s, THEME.card, THEME.outline, 6 * s, alpha);
  g.fillStyle(THEME.card, alpha);
  g.fillCircle(x - 30 * s, y - 28 * s, 22 * s);
  g.fillCircle(x + 2 * s, y - 40 * s, 24 * s);
  g.fillCircle(x + 32 * s, y - 24 * s, 20 * s);
  g.fillStyle(shade(THEME.card, 0.8), alpha);
  g.fillEllipse(x + 30 * s, y - 52 * s, 30 * s, 16 * s);
  g.fillEllipse(x + 74 * s, y - 50 * s, 30 * s, 16 * s);
  circle(g, x + 52 * s, y - 24 * s, 26 * s, shade(THEME.card, 0.94), THEME.outline, 5 * s, alpha);
  g.fillStyle(THEME.outline, alpha);
  g.fillCircle(x + 62 * s, y - 28 * s, 4 * s);
  circle(g, x + 26 * s, y + 14 * s, 11 * s, THEME.gold, THEME.outline, 4 * s, alpha);
}

/** 一捆柴 */
function drawWood(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha: number): void {
  groundShadow(g, x, y + 44 * s, 160 * s, 32 * s, 0.16 * alpha);
  for (let i = 0; i < 5; i += 1) {
    const off = (i - 2) * 17 * s;
    g.lineStyle(20 * s, THEME.outline, alpha);
    g.lineBetween(x + off - 8 * s, y + 42 * s, x + off + 8 * s, y - 42 * s);
    g.lineStyle(12 * s, shade(THEME.wood, 1 - i * 0.06), alpha);
    g.lineBetween(x + off - 8 * s, y + 42 * s, x + off + 8 * s, y - 42 * s);
  }
  g.lineStyle(11 * s, 0x8a5a3a, alpha);
  g.lineBetween(x - 54 * s, y - 16 * s, x + 54 * s, y - 16 * s);
  g.lineBetween(x - 54 * s, y + 18 * s, x + 54 * s, y + 18 * s);
}

/** 一个水囊 */
function drawSkin(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha: number): void {
  groundShadow(g, x, y + 46 * s, 120 * s, 30 * s, 0.16 * alpha);
  g.fillStyle(0xb5834a, alpha);
  g.fillEllipse(x, y, 96 * s, 112 * s);
  g.lineStyle(6 * s, THEME.outline, alpha);
  g.strokeEllipse(x, y, 96 * s, 112 * s);
  roundRect(g, x - 17 * s, y - 84 * s, 34 * s, 40 * s, 13 * s, 0xa8763f, THEME.outline, 5 * s, alpha);
  circle(g, x, y - 90 * s, 13 * s, THEME.woodDeep, THEME.outline, 5 * s, alpha);
  g.lineStyle(9 * s, 0x8a5a3a, alpha);
  g.beginPath();
  g.arc(x, y - 6 * s, 56 * s, Math.PI * 0.12, Math.PI * 0.88, false);
  g.strokePath();
}

function drawOpportunity(
  g: Phaser.GameObjects.Graphics,
  kind: OpportunityKind,
  x: number,
  y: number,
  s: number,
  alpha: number,
): void {
  if (kind === 'sheep') drawSheep(g, x, y, s, alpha);
  else if (kind === 'wood') drawWood(g, x, y, s, alpha);
  else drawSkin(g, x, y, s, alpha);
}

/** 顺手牵回来的东西就摆在营地里：抓到了就看得见 */
function kept(g: Phaser.GameObjects.Graphics, state: WindowStageState, jobs: WindowJob[]): void {
  jobs.forEach((job, i) => {
    if (!state.done.includes(job.id)) return;
    const x = 300 + i * 75;
    const y = 1122;
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse(x, y + 26, 104, 32);
    drawOpportunity(g, kindOf(job, i), x, y, 0.4, 1);
  });
}

/** 机会外面那一圈：点着点着就转满；抓到了套一圈金 */
function workRing(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  progress: number,
  done: boolean,
): void {
  const r = radius + 20;
  g.lineStyle(12, THEME.outline, 0.22);
  g.strokeCircle(x, y, r);
  if (done) {
    g.lineStyle(12, THEME.gold, 0.95);
    g.strokeCircle(x, y, r);
    return;
  }
  if (progress <= 0) return;
  g.lineStyle(12, THEME.gold, 0.95);
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(progress));
  g.strokePath();
}

/** 机会身边那一圈暖光：窗口开了才亮起来 */
function glow(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, strong: boolean): void {
  const pulse = 0.5 + 0.5 * Math.sin(t / 260);
  g.fillStyle(THEME.gold, (strong ? 0.16 : 0.07) + 0.06 * pulse);
  g.fillCircle(x, y, 120 + 12 * pulse);
}

// ---------------- 队伍 ----------------

function walker(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  cloak: number,
  t: number,
  phase: number,
): void {
  const bob = Math.sin(t / 190 + phase) * 3 * s;
  const step = Math.sin(t / 150 + phase) * 9 * s;
  groundShadow(g, x, y + 4, 58 * s, 16 * s, 0.2);
  g.lineStyle(12 * s, CLOTH_DEEP, 1);
  g.lineBetween(x - 11 * s, y - 34 * s, x - 11 * s + step, y);
  g.lineBetween(x + 11 * s, y - 34 * s, x + 11 * s - step, y);
  g.fillStyle(cloak, 1);
  g.beginPath();
  g.moveTo(x - 27 * s, y - 28 * s);
  g.lineTo(x + 27 * s, y - 28 * s);
  g.lineTo(x + 19 * s, y - 94 * s + bob);
  g.lineTo(x - 19 * s, y - 94 * s + bob);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokePath();
  g.lineStyle(10 * s, cloak, 1);
  g.beginPath();
  g.moveTo(x - 20 * s, y - 84 * s + bob);
  g.lineTo(x - 30 * s - step * 0.6, y - 52 * s + bob);
  g.strokePath();
  const hy = y - 114 * s + bob;
  circle(g, x, hy, 21 * s, SKIN, THEME.outline, 5 * s);
  g.fillStyle(0x3f4a63, 1);
  g.beginPath();
  g.arc(x, hy, 22 * s, Math.PI * 1.02, Math.PI * 1.98, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.beginPath();
  g.arc(x, hy, 22 * s, Math.PI * 1.02, Math.PI * 1.98, false);
  g.strokePath();
  g.lineStyle(6 * s, 0x3f4a63, 1);
  g.lineBetween(x - 25 * s, hy - 12 * s, x + 25 * s, hy - 12 * s);
}

/** 走在最前面的那一个：扛着一面小旗 */
function leader(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, t: number, phase: number): void {
  walker(g, x, y, s, shade(CLOTH, 0.86), t, phase);
  g.lineStyle(6 * s, THEME.woodDeep, 1);
  g.lineBetween(x + 16 * s, y - 60 * s, x + 26 * s, y - 212 * s);
  g.fillStyle(THEME.red, 1);
  g.beginPath();
  g.moveTo(x + 26 * s, y - 210 * s);
  g.lineTo(x + 94 * s, y - 188 * s);
  g.lineTo(x + 26 * s, y - 158 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(4 * s, THEME.outline, 1);
  g.strokePath();
}

/** 走在路上的一小队：旗手在前，三个人跟着 */
function squad(g: Phaser.GameObjects.Graphics, deg: number, t: number): void {
  for (const [i, off] of [-9, -23, -37].entries()) {
    const p = roadPoint(deg + off);
    if (i === 0) leader(g, p.x, p.y, 0.92, t, 0);
    else walker(g, p.x, p.y, 0.86 - i * 0.05, i % 2 === 0 ? CLOTH : shade(CLOTH, 0.9), t, i * 2.1);
  }
}

/** 雪一直在下 */
function snowfall(g: Phaser.GameObjects.Graphics, t: number): void {
  for (let i = 0; i < 46; i += 1) {
    const speed = 0.05 + (i % 5) * 0.012;
    const x = ((i * 137.5 + t * speed * 0.5) % (W + 40)) - 20;
    const y = TOP + ((i * 219.3 + t * speed) % (H - TOP));
    g.fillStyle(0xffffff, 0.3 + (i % 4) * 0.14);
    g.fillCircle(x, y, 2 + (i % 3));
  }
}

/** 这一趟走了多少：一盏小灯笼往尽头那面小旗挪，走完就回到起点 */
function tripGauge(g: Phaser.GameObjects.Graphics, state: WindowStageState): void {
  const x0 = 206;
  const x1 = 520;
  const y = 210;
  g.fillStyle(THEME.outline, 0.22);
  g.fillRoundedRect(x0 - 8, y - 14, x1 - x0 + 16, 28, 14);
  g.fillStyle(THEME.paper, 0.3);
  g.fillRoundedRect(x0, y - 8, x1 - x0, 16, 8);
  const p = clamp01(state.travelProgress);
  g.fillStyle(THEME.gold, 0.9);
  g.fillRoundedRect(x0, y - 8, Math.max(16, (x1 - x0) * p), 16, 8);
  const lx = x0 + (x1 - x0) * p;
  g.fillStyle(FIRE, 0.95);
  g.fillCircle(lx, y, 15);
  g.lineStyle(4, THEME.outline, 1);
  g.strokeCircle(lx, y, 15);
  g.lineStyle(5, THEME.woodDeep, 1);
  g.lineBetween(x1 + 22, y + 18, x1 + 22, y - 34);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x1 + 22, y - 34, x1 + 22, y - 10, x1 + 56, y - 22);
  g.lineStyle(3, THEME.outline, 1);
  g.strokeTriangle(x1 + 22, y - 34, x1 + 22, y - 10, x1 + 56, y - 22);
}

// ---------------- 整屏 ----------------

export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  state: WindowStageState,
  jobs: WindowJob[],
): void {
  const t = state.elapsedMs;
  sky(g, t);
  city(g);
  snowField(g);
  road(g);
  campGate(g);
  camp(g, t);
  kept(g, state, jobs);

  // 这一轮路过的那件机会（抓到了就只剩木架上那一件）
  const index = jobs.findIndex((job) => job.id === state.activeJobId);
  const active = index >= 0 ? jobs[index]! : undefined;
  const grabbed = active !== undefined && state.done.includes(active.id);
  if (active !== undefined && !grabbed && (state.phase === 'window' || state.phase === 'warn')) {
    const open = state.phase === 'window';
    glow(g, active.x, active.y, t, open && state.canWork);
    drawOpportunity(g, kindOf(active, index), active.x, active.y, 1, open ? 1 : 0.45);
    if (open) {
      workRing(g, active.x, active.y, active.radius, state.work[active.id] ?? 0, false);
    }
  }

  squad(g, squadDeg(state, jobs), t);
  snowfall(g, t);
  tripGauge(g, state);

  if (state.finished) {
    g.fillStyle(THEME.gold, 0.1);
    g.fillRect(0, TOP, W, H - TOP);
  }
}

/** 收尾：三件都抓到了，营门口一片暖光 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(375, 1010, 360);
  g.lineStyle(8, THEME.gold, 0.45);
  g.strokeCircle(375, 1010, 296);
}

// ---------------- 分幕插图 ----------------

/** 两幕：①雪夜赶路，路边一只走散的羊 ②顺手带上，队伍一步没停 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(NIGHT, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  circle(g, x + w * 0.8, y + 100, 50, 0xfff3d4, null, 0, 0.95);
  for (const [sx, sy, sr] of [[x + 66, y + 130, 5], [x + 200, y + 78, 4], [x + 404, y + 146, 4], [x + 528, y + 74, 5], [x + 300, y + 200, 3]] as const) {
    g.fillStyle(THEME.paper, 0.8);
    g.fillCircle(sx, sy, sr);
  }
  // 雪地
  g.fillStyle(SNOW, 1);
  g.fillRoundedRect(x + 6, y + h * 0.48, w - 12, h * 0.52 - 6, { tl: 150, tr: 150, bl: 28, br: 28 });
  // 远处的城墙
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(x + w * 0.6, y + h * 0.4, w * 0.34, h * 0.1);
  g.fillTriangle(x + w * 0.6, y + h * 0.4, x + w * 0.68, y + h * 0.34, x + w * 0.76, y + h * 0.4);
  // 路
  const ax = x + 46;
  const ay = y + h * 0.94;
  const bx = x + w - 46;
  const by = y + h * 0.66;
  g.lineStyle(74, ROAD_FILL, 1);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(16, 0xffffff, 0.4);
  g.lineBetween(ax + 10, ay - 14, bx - 10, by - 10);
  // 营地的两个帐篷（第二幕在远处已经看得见）
  if (index === 1) {
    tent(g, x + w * 0.74, y + h * 0.62, 0.34);
    tent(g, x + w * 0.88, y + h * 0.66, 0.3);
  }
  // 队伍
  for (let i = 0; i < 3; i += 1) {
    const u = 0.16 + i * 0.15;
    const px = ax + (bx - ax) * u;
    const py = ay + (by - ay) * u;
    if (i === 0) leader(g, px, py, 0.52, 0, 0);
    else walker(g, px, py, 0.48, i % 2 === 0 ? CLOTH : shade(CLOTH, 0.9), 0, i * 2);
  }
  if (index === 0) {
    // 走散的羊缩在路边的雪里
    drawSheep(g, x + w * 0.26, y + h * 0.78, 0.62, 1);
    return;
  }
  // 顺手带上：羊跟在队伍后面，一起走
  drawSheep(g, x + w * 0.4, y + h * 0.86, 0.5, 1);
}