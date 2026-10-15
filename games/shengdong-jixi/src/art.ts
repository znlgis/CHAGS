import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { RuseStageState } from '@chags/templates';
import type { RuseLevel } from '@chags/templates/schemas';
import { CAMP_Y, PATH, SKY_BOTTOM, STARS, TOWER } from './layout';

const NIGHT = 0x2c3a5c;
const NIGHT_DEEP = 0x222c47;
const PAPER = 0xfdf3dc;
const DUNE = shade(THEME.sand, 0.62);
const DUNE_DEEP = shade(THEME.sand, 0.48);
const W = DESIGN.width;
const H = DESIGN.height;

// ---------------- 三件东西：粮车 / 火把 / 水囊 ----------------

/** 要连夜带过去的东西 */
export function drawItem(g: Phaser.GameObjects.Graphics, kind: string): void {
  groundShadow(g, 0, 56, 132, 30, 0.2);
  if (kind === 'cart') {
    roundRect(g, -84, -20, 168, 62, 20, THEME.wood, THEME.outline, 6);
    circle(g, -52, 48, 28, THEME.woodDeep, THEME.outline, 6);
    circle(g, 54, 48, 28, THEME.woodDeep, THEME.outline, 6);
    roundRect(g, -70, -70, 54, 56, 18, PAPER, THEME.outline, 5);
    roundRect(g, -6, -78, 54, 64, 18, THEME.sand, THEME.outline, 5);
    roundRect(g, 52, -66, 42, 52, 16, PAPER, THEME.outline, 5);
    roundRect(g, -6, 22, 20, 76, 9, THEME.wood, THEME.outline, 5);
    return;
  }
  if (kind === 'torch') {
    roundRect(g, -11, -40, 22, 120, 10, THEME.wood, THEME.outline, 5);
    g.fillStyle(THEME.red, 1);
    g.fillTriangle(-38, -46, 38, -46, 0, -150);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(-38, -46, 38, -46, 0, -150);
    g.fillStyle(THEME.gold, 1);
    g.fillTriangle(-20, -50, 20, -50, 0, -110);
    return;
  }
  // 水囊
  roundRect(g, -58, -46, 116, 108, 40, 0xb5825a, THEME.outline, 6);
  roundRect(g, -16, -92, 32, 52, 14, 0x8d6042, THEME.outline, 5);
  roundRect(g, -22, -104, 44, 20, 9, THEME.wood, THEME.outline, 5);
}

/** 一条四边形（路、光带都靠它）：两个三角形拼起来，不碰 Phaser 的几何类 */
function fillQuad(
  g: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): void {
  g.fillTriangle(ax, ay, bx, by, cx, cy);
  g.fillTriangle(ax, ay, cx, cy, dx, dy);
}

/** 关口：两根石柱 + 横梁，东西从中间拖过去 */
function drawGate(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
  roundRect(g, x - radius - 34, y - radius - 30, 40, radius * 2 + 30, 14, THEME.stone, THEME.outline, 6);
  roundRect(g, x + radius - 6, y - radius - 30, 40, radius * 2 + 30, 14, THEME.stone, THEME.outline, 6);
  roundRect(g, x - radius - 52, y - radius - 78, radius * 2 + 104, 50, 20, THEME.woodDeep, THEME.outline, 6);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(x, y - radius - 54, 15);
}

/** 望楼：灯就架在顶上 */
function drawTower(g: Phaser.GameObjects.Graphics): void {
  roundRect(g, TOWER.x - 74, TOWER.y + 10, 26, 150, 12, THEME.woodDeep, THEME.outline, 6);
  roundRect(g, TOWER.x + 48, TOWER.y + 10, 26, 150, 12, THEME.woodDeep, THEME.outline, 6);
  roundRect(g, TOWER.x - 96, TOWER.y - 10, 192, 34, 14, THEME.wood, THEME.outline, 6);
  roundRect(g, TOWER.x - 40, TOWER.y - 58, 80, 56, 18, THEME.wood, THEME.outline, 6);
}

/** 守军的营帐 */
function drawTent(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(THEME.redDeep, 1);
  g.fillTriangle(x - w / 2, y, x + w / 2, y, x, y - h);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - w / 2, y, x + w / 2, y, x, y - h);
  g.fillStyle(shade(THEME.redDeep, 1.25), 1);
  g.fillTriangle(x - w * 0.18, y, x + w * 0.18, y, x, y - h * 0.72);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(x, y - h - 10, 10);
}

/** 这个世界：夜空、沙丘、望楼、关口、守军的营帐（画一次） */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: RuseLevel): void {
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, 0, W, SKY_BOTTOM + 40);
  for (const star of STARS) {
    g.fillStyle(PAPER, 0.8);
    g.fillCircle(star.x, star.y, star.r);
  }
  circle(g, 112, 250, 58, PAPER, THEME.outline, 5);
  g.fillStyle(shade(PAPER, 0.86), 1);
  g.fillCircle(96, 236, 12);
  g.fillCircle(130, 268, 9);

  // 远山与沙丘
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillEllipse(180, SKY_BOTTOM + 30, 620, 240);
  g.fillEllipse(600, SKY_BOTTOM + 10, 560, 200);
  g.fillStyle(DUNE, 1);
  g.fillRect(0, SKY_BOTTOM, W, H - SKY_BOTTOM);
  g.fillStyle(DUNE_DEEP, 1);
  g.fillEllipse(120, SKY_BOTTOM + 240, 700, 320);
  g.fillEllipse(660, SKY_BOTTOM + 150, 620, 260);

  // 从右下角绕上关口的那条小路
  g.fillStyle(shade(THEME.sand, 0.78), 1);
  fillQuad(
    g,
    PATH.fromX - 150,
    PATH.fromY,
    PATH.fromX + 60,
    PATH.fromY,
    PATH.toX + 96,
    PATH.toY,
    PATH.toX - 96,
    PATH.toY,
  );

  drawGate(g, level.gate.x, level.gate.y, level.gate.radius);
  drawTower(g);

  // 守军的营帐都扎在左边 —— 兵都被"东边"引过去了，右边才是空的
  for (const x of [110, 250, 386] as const) {
    drawTent(g, x, CAMP_Y, 120, 96);
  }
}

/** 每帧：灯光扫向哪边、锣鼓缓过来没有、已经过去了几件 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: RuseStageState,
  level: RuseLevel,
): void {
  const gaze = level.gaze;
  const lit = state.phase === 'lit';
  const warn = state.phase === 'warn';
  const target = gaze ? (state.gaze === 'left' ? gaze.left : gaze.right) : { x: 375, y: 620 };
  const near = 1 - state.msToLight / Math.max(1, state.cycleMs);

  // 关口：淡淡的金边
  g.lineStyle(6, THEME.gold, lit && state.seen.length > 0 ? 0.8 : 0.4);
  g.strokeRect(level.gate.x - level.gate.radius, level.gate.y - level.gate.radius, level.gate.radius * 2, level.gate.radius * 2);

  // 灯光：暗的时候只是挂着，征兆时指个方向，亮起来就照到那一边
  g.fillStyle(0xfff2c0, lit ? 0.4 : warn ? 0.15 : 0.07);
  g.fillTriangle(TOWER.x, TOWER.y, target.x - 150, target.y + 90, target.x + 150, target.y + 90);
  g.fillStyle(0xfff6d0, lit ? 0.3 : warn ? 0.1 : 0.05);
  g.fillEllipse(target.x, target.y + 60, 420, 220);
  circle(g, TOWER.x, TOWER.y, lit ? 44 : warn ? 38 : 30, lit ? 0xfff3c8 : THEME.gold, THEME.outline, 6);
  if (!lit) {
    g.lineStyle(7, 0xfff3c8, 0.9);
    g.beginPath();
    g.arc(TOWER.x, TOWER.y, 56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * near, false);
    g.strokePath();
  }

  // 锣鼓：缓过来了才能再敲；灯正照着右边（要坏事）的时候，它们会一圈圈招手
  const pulse = 1 - state.litMsLeft / Math.max(1, state.litMs);
  const call = lit && state.gaze === 'right';
  for (const noise of level.noises) {
    drawNoise(g, noise.id, noise.x, noise.y, state.noiseReady);
    if (call && state.noiseReady) {
      g.lineStyle(8, THEME.gold, 0.8 * (1 - pulse));
      g.strokeCircle(noise.x, noise.y, 74 + 46 * pulse);
    }
    if (state.lastNoise === noise.id && state.holdMsLeft > 0) {
      const wave = 1 - (state.holdMsLeft % 600) / 600;
      g.lineStyle(7, PAPER, 0.7 * (1 - wave));
      g.strokeCircle(noise.x, noise.y, 66 + 70 * wave);
    }
  }

  // 已经过去的东西：关口边上多一盏灯
  state.passed.forEach((_id, index) => {
    circle(g, level.gate.x - 130 + index * 62, level.gate.y + 150, 15, THEME.gold, THEME.outline, 5);
  });
}

/** 锣与鼓：一个铜盘、一个皮鼓，都挂在架子上 */
function drawNoise(
  g: Phaser.GameObjects.Graphics,
  id: string,
  x: number,
  y: number,
  ready: boolean,
): void {
  const gold = ready ? THEME.gold : shade(THEME.gold, 0.66);
  g.fillStyle(THEME.woodDeep, 1);
  g.fillRect(x - 54, y + 30, 12, 62);
  g.fillRect(x + 42, y + 30, 12, 62);
  g.lineStyle(6, THEME.outline, 1);
  if (id.startsWith('gong')) {
    circle(g, x, y, 58, gold, THEME.outline, 6);
    circle(g, x, y, 22, shade(gold, 0.82), THEME.outline, 5);
    roundRect(g, x - 8, y - 96, 16, 42, 8, THEME.wood, THEME.outline, 5);
    return;
  }
  roundRect(g, x - 62, y - 46, 124, 96, 30, ready ? THEME.red : shade(THEME.red, 0.66), THEME.outline, 6);
  g.lineStyle(6, PAPER, 1);
  g.lineBetween(x - 62, y, x + 62, y);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x - 20, y - 46, x - 44, y - 96);
  g.lineBetween(x + 20, y - 46, x + 44, y - 96);
}

/** 收尾：天快亮了，关口那边一路灯亮着 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _state: RuseStageState,
  level: RuseLevel,
): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(level.gate.x, level.gate.y, 320);
  g.lineStyle(8, THEME.gold, 0.6);
  g.strokeRect(
    level.gate.x - level.gate.radius - 14,
    level.gate.y - level.gate.radius - 14,
    level.gate.radius * 2 + 28,
    level.gate.radius * 2 + 28,
  );
  g.fillStyle(THEME.gold, 0.18);
  fillQuad(
    g,
    PATH.fromX - 170,
    PATH.fromY,
    PATH.fromX + 70,
    PATH.fromY,
    PATH.toX + 110,
    PATH.toY,
    PATH.toX - 110,
    PATH.toY,
  );
}

// ---------------- 分幕插图 ----------------

function drawPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  s = 1,
): void {
  groundShadow(g, x, y + 4 * s, 88 * s, 22 * s, 0.2);
  roundRect(g, x - 30 * s, y - 92 * s, 60 * s, 96 * s, 24 * s, color, THEME.outline, 5 * s);
  circle(g, x, y - 118 * s, 27 * s, 0xf6d3ae, THEME.outline, 5 * s);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 128 * s, 56 * s, 22 * s);
}

/** 一支支长矛：兵都调到这一边来了 */
function drawSpears(g: Phaser.GameObjects.Graphics, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const px = x + i * 34;
    g.lineStyle(7, THEME.woodDeep, 1);
    g.lineBetween(px, y, px + 14, y - 120);
    g.fillStyle(THEME.stone, 1);
    g.fillTriangle(px + 6, y - 118, px + 22, y - 118, px + 14, y - 152);
  }
}

/** 分幕插图：① 到处说要往东走 ② 连夜从西边过去了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  if (index === 0) {
    // ① 白天：左边（东边）吵吵嚷嚷，右边（西边）空空的
    g.fillStyle(THEME.sky, 1);
    g.fillRoundedRect(x, y, w, h, 34);
    g.fillStyle(THEME.sand, 1);
    g.fillRoundedRect(x - 20, y + h * 0.58, w + 40, h * 0.46, 30);
    g.fillStyle(THEME.gold, 0.4);
    g.fillCircle(x + w * 0.84, y + h * 0.16, 38);
    // 东边：帐篷 + 长矛 + 一群兵
    drawSpears(g, x + w * 0.12, y + h * 0.62, 5);
    drawTent(g, x + w * 0.18, y + h * 0.72, 130, 104);
    drawTent(g, x + w * 0.36, y + h * 0.7, 104, 88);
    drawPerson(g, x + w * 0.3, y + h * 0.82, THEME.redDeep, 0.7);
    drawPerson(g, x + w * 0.44, y + h * 0.84, THEME.redDeep, 0.7);
    // 班超把话放出去（一只手掌 + 一条指向东边的箭头）
    drawPerson(g, x + w * 0.66, y + h * 0.86, THEME.teal, 0.9);
    g.lineStyle(9, THEME.tealDeep, 0.9);
    g.beginPath();
    g.arc(x + w * 0.66, y + h * 0.72, 46, Math.PI * 0.9, Math.PI * 1.9, false);
    g.strokePath();
    g.fillStyle(THEME.tealDeep, 0.9);
    g.fillTriangle(x + w * 0.22, y + h * 0.3, x + w * 0.34, y + h * 0.24, x + w * 0.3, y + h * 0.38);
    return;
  }
  // ② 夜里：守军还盯着左边，人却从右边过去了
  g.fillStyle(NIGHT, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  circle(g, x + w * 0.16, y + h * 0.18, 40, PAPER, THEME.outline, 5);
  g.fillStyle(DUNE, 1);
  g.fillRoundedRect(x - 20, y + h * 0.62, w + 40, h * 0.42, 30);
  drawTent(g, x + w * 0.16, y + h * 0.74, 120, 96);
  drawPerson(g, x + w * 0.26, y + h * 0.86, THEME.redDeep, 0.7);
  // 一队人贴着右边往西走
  for (let i = 0; i < 3; i += 1) {
    drawPerson(g, x + w * 0.56 + i * w * 0.12, y + h * 0.84 + i * 10, THEME.teal, 0.62);
  }
  g.lineStyle(8, THEME.gold, 0.85);
  g.lineBetween(x + w * 0.9, y + h * 0.8, x + w * 0.52, y + h * 0.8);
}
