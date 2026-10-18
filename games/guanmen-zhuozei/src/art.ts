import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { SIEGE } from '@chags/templates/siege';
import type { SiegeCloseMetrics } from '@chags/templates';
import { clamp01 } from '@chags/game-kit';
import {
  AMBUSH, BAR, ESCAPE_AFTER_MS, EXITS, EXIT_RADIUS, NIGHT_TOP, THIEF, VALLEY_TOP,
  WALL_LEFT, WALL_RIGHT,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const NIGHT = 0x2b3550;
const NIGHT_DEEP = 0x1b2338;
const WALL = 0x41506b;
const WALL_DEEP = 0x2f3b52;
const ROAD = 0x6a6350;
const ROAD_LIGHT = 0x847b62;
const SKIN = 0xf8dcbb;
const GATE_W = 152;
const GATE_H = 168;

/** 一块多边形：山壁与路都用它铺 */
function fillPoly(
  g: Phaser.GameObjects.Graphics,
  pts: readonly { x: number; y: number }[],
  color: number,
  alpha = 1,
): void {
  const first = pts[0];
  if (first === undefined) return;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of pts) g.lineTo(point.x, point.y);
  g.closePath();
  g.fillPath();
}

// ---------------- 景 ----------------

/** 夜里的天：深蓝的底、月亮、几颗一直在眨的星 */
function drawNight(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, NIGHT_TOP, W, H - NIGHT_TOP);
  g.fillStyle(NIGHT_DEEP, 0.5);
  g.fillRect(0, NIGHT_TOP, W, 300);
  for (let i = 0; i < 16; i += 1) {
    const sx = 30 + ((i * 149) % 690);
    const sy = NIGHT_TOP + 24 + ((i * 97) % 340);
    g.fillStyle(THEME.paper, 0.3 + 0.3 * Math.sin(t / 700 + i));
    g.fillCircle(sx, sy, 4);
  }
  g.fillStyle(THEME.paper, 0.9);
  g.fillCircle(628, 244, 44);
  g.fillStyle(NIGHT, 1);
  g.fillCircle(612, 232, 36);
}

/** 两壁夹着一条道：马陵道窄得只能走一条路 */
function drawValley(g: Phaser.GameObjects.Graphics, t: number): void {
  // 道：从北口一直通到南口
  g.fillStyle(ROAD, 1);
  g.fillRect(238, VALLEY_TOP + 60, 274, 1140);
  g.fillStyle(ROAD_LIGHT, 1);
  g.fillRect(292, VALLEY_TOP + 60, 166, 1140);
  // 路上几块碎石
  for (let i = 0; i < 7; i += 1) {
    const sx = 300 + ((i * 113) % 150);
    const sy = 420 + ((i * 197) % 640);
    circle(g, sx, sy, 11, shade(THEME.stone, 0.8), THEME.outline, 4);
  }

  // 两壁：先铺一层深的，再铺一层浅的错落山脊
  fillPoly(g, WALL_LEFT, WALL_DEEP);
  fillPoly(g, WALL_RIGHT, WALL_DEEP);
  g.fillStyle(WALL, 1);
  for (let i = 0; i < 7; i += 1) {
    const y = 300 + i * 156;
    const tall = 74 + ((i * 53) % 46);
    g.fillTriangle(-30, y, 92 + ((i * 37) % 40), y - tall, 96, y + 60);
    g.fillTriangle(W + 30, y, W - 92 - ((i * 37) % 40), y - tall, W - 96, y + 60);
  }
  // 山脊上的松树：夜风一吹轻轻晃
  for (let i = 0; i < 8; i += 1) {
    const left = i % 2 === 0;
    const x = left ? 46 + ((i * 29) % 60) : W - 46 - ((i * 29) % 60);
    const y = 320 + i * 128;
    const sway = Math.sin(t / 900 + i) * 5;
    g.lineStyle(12, shade(THEME.leaf, 0.42), 1);
    g.lineBetween(x, y, x + sway, y - 92);
    g.fillStyle(shade(THEME.leaf, 0.42), 1);
    g.fillTriangle(x - 40 + sway, y - 60, x + sway, y - 128, x + 40 + sway, y - 60);
    g.lineStyle(5, THEME.outline, 0.5);
    g.strokeTriangle(x - 40 + sway, y - 60, x + sway, y - 128, x + 40 + sway, y - 60);
  }
}

/** 山脊上的伏兵：一个探出来的身影 + 一面旗（孙膑的兵早就在这儿等着了） */
function drawAmbush(
  g: Phaser.GameObjects.Graphics,
  spot: { x: number; y: number; flip: boolean },
  t: number,
  index: number,
): void {
  const side = spot.flip ? -1 : 1;
  const x = spot.x;
  const y = spot.y + Math.sin(t / 620 + index) * 3;
  // 旗
  g.lineStyle(7, THEME.outline, 1);
  g.lineBetween(x + side * 44, y + 10, x + side * 44, y - 118);
  g.fillStyle(THEME.teal, 1);
  g.fillTriangle(x + side * 44, y - 118, x + side * 116, y - 92, x + side * 44, y - 66);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x + side * 44, y - 118, x + side * 116, y - 92, x + side * 44, y - 66);
  // 身影：只探出上半身
  circle(g, x, y - 34, 24, SKIN, THEME.outline, 6);
  circle(g, x, y - 54, 21, THEME.inkSoft, THEME.outline, 5);
  roundRect(g, x - 30, y - 16, 60, 44, 16, shade(THEME.tealDeep, 0.98), THEME.outline, 6);
}

/** 一扇营门：门框 + 门洞 + 两扇门板（按关到几分从两边往中间合） */
function drawGate(
  g: Phaser.GameObjects.Graphics,
  exit: { id: string; x: number; y: number },
  closed: boolean,
  closing: number,
): void {
  const { x, y } = exit;
  // 门洞：开着的时候能看见里头的夜色
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(x - GATE_W / 2, y - GATE_H / 2, GATE_W, GATE_H);
  // 两扇门板
  const shut = closed ? 1 : clamp01(closing);
  const panel = (GATE_W / 2) * shut;
  if (panel > 2) {
    roundRect(g, x - GATE_W / 2, y - GATE_H / 2, panel, GATE_H, 6, shade(THEME.wood, 0.86), THEME.outline, 5);
    roundRect(g, x + GATE_W / 2 - panel, y - GATE_H / 2, panel, GATE_H, 6, shade(THEME.wood, 0.86), THEME.outline, 5);
  }
  // 门框：两根柱子 + 横梁
  roundRect(g, x - GATE_W / 2 - 28, y - GATE_H / 2 - 40, 28, GATE_H + 46, 8, THEME.woodDeep, THEME.outline, 6);
  roundRect(g, x + GATE_W / 2, y - GATE_H / 2 - 40, 28, GATE_H + 46, 8, THEME.woodDeep, THEME.outline, 6);
  roundRect(g, x - GATE_W / 2 - 44, y - GATE_H / 2 - 76, GATE_W + 88, 46, 14, THEME.redDeep, THEME.outline, 7);
  // 门楼上挂的灯笼：关严了就点亮
  const lantern = closed ? THEME.gold : shade(THEME.red, 0.8);
  circle(g, x, y - GATE_H / 2 - 52, 18, lantern, THEME.outline, 5);
  if (closed) {
    // 门闩：横着插上
    g.lineStyle(16, THEME.inkSoft, 1);
    g.lineBetween(x - GATE_W / 2, y - 4, x + GATE_W / 2, y - 4);
    g.lineStyle(6, THEME.outline, 1);
    g.lineBetween(x - GATE_W / 2, y - 4, x + GATE_W / 2, y - 4);
  }
}

/** 贼：抱着一个小包袱（没有刀，也不伤人 —— 他只是要跑） */
function drawThief(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  t: number,
  running: boolean,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const bob = running ? Math.abs(Math.sin(t / 90)) * 9 : Math.sin(t / 460) * 3;
  const top = y - 92 - bob;
  groundShadow(g, x, y + 12, 108, 26, 0.3 * alpha);
  roundRect(g, x - 30, top, 60, 92, 20, shade(THEME.inkSoft, 1.12), THEME.outline, 6, alpha);
  // 怀里抱着的包袱
  circle(g, x + 36, top + 54, 26, THEME.goldDeep, THEME.outline, 6, alpha);
  g.lineStyle(5, THEME.outline, alpha);
  g.lineBetween(x + 22, top + 34, x + 50, top + 34);
  // 头与头巾
  circle(g, x, top - 26, 24, SKIN, THEME.outline, 6, alpha);
  circle(g, x, top - 46, 20, THEME.inkSoft, THEME.outline, 5, alpha);
  g.fillStyle(THEME.outline, alpha);
  g.fillCircle(x - 8, top - 26, 4);
  g.fillCircle(x + 8, top - 26, 4);
  // 两条腿：跑起来的时候前后甩
  const stride = running ? Math.sin(t / 80) * 14 : 0;
  g.lineStyle(12, THEME.outline, alpha);
  g.lineBetween(x - 12, top + 88, x - 12 + stride, top + 116);
  g.lineBetween(x + 12, top + 88, x + 12 - stride, top + 116);
}

/** 贼这一刻在哪儿：没跑的时候会一点点朝他要去的那扇门挪，跑了就一路冲出去 */
function thiefView(stage: SiegeCloseMetrics): { x: number; y: number; running: boolean; alpha: number } {
  if (stage.escaped && stage.escapedAtMs >= 0) {
    const exit = EXITS.find((item) => item.id === stage.escapedExitId) ?? EXITS[0];
    const p = clamp01((stage.elapsedMs - stage.escapedAtMs) / SIEGE.escapeRunMs);
    const ease = p * p * (3 - 2 * p);
    const gone = clamp01((stage.elapsedMs - stage.escapedAtMs - SIEGE.escapeRunMs) / 700);
    return {
      x: THIEF.x + (exit.x - THIEF.x) * ease,
      y: THIEF.y + (exit.y - THIEF.y) * ease,
      running: true,
      alpha: 1 - gone,
    };
  }
  const exit = EXITS.find((item) => item.id === stage.escapeExitId);
  if (exit === undefined) return { x: THIEF.x, y: THIEF.y, running: false, alpha: 1 };
  const anxious = 1 - clamp01(stage.escapeLeftMs / Math.max(1, ESCAPE_AFTER_MS));
  const creep = 0.24 * anxious;
  return {
    x: THIEF.x + (exit.x - THIEF.x) * creep,
    y: THIEF.y + (exit.y - THIEF.y) * creep,
    running: false,
    alpha: 1,
  };
}

/** 倒计时的钟：一条随时间变短变红的钟，上面挂四扇门的小图示 */
function drawClock(g: Phaser.GameObjects.Graphics, stage: SiegeCloseMetrics): void {
  roundRect(g, BAR.x, BAR.y, BAR.w, BAR.h, BAR.h / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  const left = stage.escapeAfterMs > 0 ? clamp01(stage.escapeLeftMs / stage.escapeAfterMs) : 0;
  const inner = BAR.w - 12;
  const fill = Math.max(0, inner * left);
  const color = left > 0.5 ? THEME.teal : left > 0.22 ? THEME.gold : THEME.red;
  if (fill > 8) {
    roundRect(g, BAR.x + 6, BAR.y + 6, fill, BAR.h - 12, (BAR.h - 12) / 2, color, null, 0);
  }
  // 四扇门的小图示：关上的画成实心，正在关的画一半
  const span = Math.max(1, stage.total - 1);
  EXITS.forEach((exit, index) => {
    const bx = BAR.x + 40 + index * ((BAR.w - 80) / span);
    const closed = stage.closed.includes(exit.id);
    const turning = stage.closingId === exit.id;
    roundRect(
      g,
      bx - 15,
      BAR.y - 30,
      30,
      22,
      4,
      closed ? THEME.gold : turning ? shade(THEME.gold, 0.75) : shade(THEME.card, 0.9),
      THEME.outline,
      4,
    );
  });
}

// ---------------- 每帧 ----------------

/** 每帧：夜色、山谷两壁、山脊上的伏兵、四个营门、贼、倒计时的钟 */
export function drawClose(g: Phaser.GameObjects.Graphics, stage: SiegeCloseMetrics): void {
  drawNight(g, stage.elapsedMs);
  drawValley(g, stage.elapsedMs);
  AMBUSH.forEach((spot, index) => drawAmbush(g, spot, stage.elapsedMs, index));
  EXITS.forEach((exit) => {
    const closed = stage.closed.includes(exit.id);
    const closing = stage.closingId === exit.id ? stage.closingRatio : 0;
    drawGate(g, exit, closed, closing);
  });
  const thief = thiefView(stage);
  drawThief(g, thief.x, thief.y, stage.elapsedMs, thief.running, thief.alpha);
  drawClock(g, stage);
}

/** 捉住了：四扇门都插上门闩，营盘里亮起一圈金光 */
export function drawCloseFinale(
  g: Phaser.GameObjects.Graphics,
  stage: SiegeCloseMetrics,
): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(THIEF.x, THIEF.y, 300);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(THIEF.x, THIEF.y, 250);
  for (const exit of EXITS) {
    if (!stage.closed.includes(exit.id)) continue;
    g.lineStyle(9, THEME.gold, 0.6);
    g.strokeCircle(exit.x, exit.y, EXIT_RADIUS + 30);
  }
}

/** 分幕插图：① 马陵道又窄又险，孙膑在山上看地形 ② 夜里的营门，门闩插上了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillRoundedRect(x, y + h * 0.7, w, h * 0.3, 30);

  if (index === 0) {
    // ① 两壁夹着一条窄道，孙膑站在山脊上往下看
    g.fillStyle(WALL, 1);
    g.fillTriangle(x - 20, y + h * 0.78, x + w * 0.3, y + h * 0.12, x + w * 0.42, y + h * 0.78);
    g.fillTriangle(x + w + 20, y + h * 0.78, x + w * 0.72, y + h * 0.12, x + w * 0.6, y + h * 0.78);
    g.fillStyle(ROAD_LIGHT, 1);
    g.fillRect(x + w * 0.42, y + h * 0.5, w * 0.18, h * 0.34);
    drawAmbush(g, { x: x + w * 0.3, y: y + h * 0.3, flip: false }, 0, 0);
    drawAmbush(g, { x: x + w * 0.72, y: y + h * 0.3, flip: true }, 0, 1);
    return;
  }

  // ② 夜里的营门：门板合上、门闩插好，两只灯笼亮着
  g.fillStyle(NIGHT_DEEP, 0.4);
  g.fillRoundedRect(x, y, w, h * 0.7, 30);
  drawGate(g, { id: 'beat', x: x + w * 0.5, y: y + h * 0.52 }, true, 1);
  drawGate(g, { id: 'beat2', x: x + w * 0.18, y: y + h * 0.44 }, true, 1);
  drawGate(g, { id: 'beat3', x: x + w * 0.82, y: y + h * 0.44 }, true, 1);
}
