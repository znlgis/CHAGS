import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { BurrowStageState } from '@chags/templates';
import type { BurrowSpot } from '@chags/templates/schemas';
import { DEN_Y, MEADOW_Y, RABBIT_HOME, SKY_TOP, TUNNEL_BOTTOM, TUNNEL_TOP } from './layout';

/** 兔子：在草地上、探出头、缩在洞里、睡着 */
export function drawRabbit(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  mood: 'out' | 'peek' | 'hidden' | 'sleep',
): void {
  if (mood === 'hidden') {
    // 缩在洞里：只看得见两只耳朵
    for (const dx of [-16, 16] as const) {
      roundRect(g, x + dx - 7, y - 30, 14, 34, 7, 0xfdf3dc, THEME.outline, 4);
    }
    return;
  }
  const sleep = mood === 'sleep';
  g.fillStyle(0xfdf3dc, 1);
  g.fillEllipse(x, y, 96, 74);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y, 96, 74);
  for (const dx of [-24, 24] as const) {
    roundRect(g, x + dx - 9, y - 100, 18, 66, 9, 0xfdf3dc, THEME.outline, 5);
  }
  const headX = x + (mood === 'peek' ? 36 : 30);
  g.fillStyle(0xfdf3dc, 1);
  g.fillCircle(headX, y - 28, 28);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(headX, y - 28, 28);
  if (sleep) {
    g.lineStyle(4, THEME.outline, 1);
    g.lineBetween(headX - 12, y - 32, headX + 4, y - 32);
  } else {
    g.fillStyle(THEME.outline, 1);
    g.fillCircle(headX + 6, y - 32, 4);
  }
  g.fillStyle(0xe58f8f, 1);
  g.fillCircle(headX + 22, y - 20, 5);
  circle(g, x - 52, y + 8, 15, 0xfdf3dc, THEME.outline, 5);
}

/** 狐狸：蹲在洞口 */
export function drawFox(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 44, 140, 30, 0.16);
  g.fillStyle(0xe9a15c, 1);
  g.fillEllipse(x + 62, y - 4, 78, 38);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x + 62, y - 4, 78, 38);
  g.fillStyle(0xd9762f, 1);
  g.fillEllipse(x, y, 112, 80);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y, 112, 80);
  g.fillStyle(0xd9762f, 1);
  g.fillTriangle(x - 62, y - 58, x - 44, y - 88, x - 32, y - 54);
  g.fillTriangle(x - 24, y - 58, x - 12, y - 88, x - 2, y - 54);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 62, y - 58, x - 44, y - 88, x - 32, y - 54);
  g.strokeTriangle(x - 24, y - 58, x - 12, y - 88, x - 2, y - 54);
  circle(g, x - 38, y - 34, 30, 0xd9762f, THEME.outline, 6);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 48, y - 38, 4);
  g.fillCircle(x - 26, y - 38, 4);
  g.fillTriangle(x - 48, y - 24, x - 30, y - 24, x - 39, y - 10);
}

/** 老鹰：守在另一个洞口上方 */
export function drawHawk(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x8a755c, 1);
  g.fillTriangle(x - 30, y - 4, x - 100, y - 36, x - 22, y + 14);
  g.fillTriangle(x + 30, y - 4, x + 100, y - 36, x + 22, y + 14);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 30, y - 4, x - 100, y - 36, x - 22, y + 14);
  g.strokeTriangle(x + 30, y - 4, x + 100, y - 36, x + 22, y + 14);
  g.fillStyle(0x6b5a49, 1);
  g.fillEllipse(x, y, 76, 46);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y, 76, 46);
  circle(g, x - 26, y - 16, 18, 0x8a755c, THEME.outline, 5);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x - 42, y - 18, x - 60, y - 12, x - 42, y - 4);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 30, y - 20, 3);
}

/** 一个洞：挖了几铲就画多深；挖通了底下多一个窝 */
function drawTunnel(
  g: Phaser.GameObjects.Graphics,
  spot: BurrowSpot,
  digs: number,
  digsNeeded: number,
): void {
  if (digs <= 0) {
    g.fillStyle(shade(THEME.sand, 0.9), 1);
    g.fillEllipse(spot.x, MEADOW_Y + 10, 130, 50);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeEllipse(spot.x, MEADOW_Y + 10, 130, 50);
    g.fillStyle(THEME.leaf, 1);
    for (const dx of [-34, 0, 34] as const) {
      g.fillTriangle(spot.x + dx - 10, MEADOW_Y + 6, spot.x + dx, MEADOW_Y - 40, spot.x + dx + 10, MEADOW_Y + 6);
    }
    return;
  }
  const progress = Math.min(1, digs / digsNeeded);
  const depth = TUNNEL_TOP + (TUNNEL_BOTTOM - TUNNEL_TOP) * progress;
  g.fillStyle(0x7a5a3a, 1);
  g.fillEllipse(spot.x, MEADOW_Y + 6, 120, 54);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(spot.x, MEADOW_Y + 6, 120, 54);
  g.fillStyle(0x2f2119, 1);
  g.fillEllipse(spot.x, MEADOW_Y + 8, 92, 36);
  g.fillStyle(0x5c4230, 1);
  g.fillRoundedRect(spot.x - 36, MEADOW_Y, 72, depth - MEADOW_Y, 26);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(spot.x - 36, MEADOW_Y, 72, depth - MEADOW_Y, 26);
  g.fillStyle(0x3d2c20, 1);
  g.fillRoundedRect(spot.x - 20, MEADOW_Y + 12, 40, Math.max(12, depth - MEADOW_Y - 24), 16);
  if (progress >= 1) {
    g.fillStyle(0x6b4c36, 1);
    g.fillEllipse(spot.x, depth + 26, 172, 112);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeEllipse(spot.x, depth + 26, 172, 112);
    g.fillStyle(0x8a6a4d, 1);
    g.fillEllipse(spot.x, depth + 34, 124, 72);
  }
}

/** 整屏世界：草地、土层、三个洞、兔子、守在洞口的狐狸与老鹰 */
export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  state: BurrowStageState,
  spots: BurrowSpot[],
): void {
  const W = DESIGN.width;
  const H = DESIGN.height;

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, MEADOW_Y - SKY_TOP + 20);
  g.fillStyle(shade(THEME.skyDeep, 1.03), 1);
  g.fillEllipse(160, MEADOW_Y - 12, 420, 190);
  g.fillEllipse(610, MEADOW_Y - 4, 500, 160);

  g.fillStyle(THEME.leaf, 1);
  g.fillRect(0, MEADOW_Y - 30, W, 62);
  g.fillStyle(shade(THEME.sand, 0.86), 1);
  g.fillRect(0, MEADOW_Y + 28, W, H - MEADOW_Y);
  g.fillStyle(shade(THEME.sand, 0.74), 1);
  g.fillRect(0, MEADOW_Y + 260, W, H - MEADOW_Y - 260);
  g.fillStyle(shade(THEME.stone, 1.06), 0.6);
  for (const [sx, sy, r] of [[90, 940, 12], [300, 1120, 9], [540, 900, 11], [670, 1200, 10], [170, 1280, 8]] as const) {
    g.fillCircle(sx, sy, r);
  }

  for (const spot of spots) {
    drawTunnel(g, spot, state.digs[spot.id] ?? 0, state.digsNeeded);
  }

  // 兔子：平时在草地上，危险来时躲在洞里或从别的洞口溜出来
  const free = state.open.filter((id) => !state.blocked.includes(id));
  if (state.phase === 'done') {
    drawRabbit(g, 375, DEN_Y, 'sleep');
  } else if (state.phase === 'danger' && state.result === 'trapped') {
    drawRabbit(g, 375, TUNNEL_BOTTOM + 20, 'hidden');
  } else if (state.phase === 'danger' && state.result === 'safe') {
    const escape = spots.find((spot) => spot.id === free[0]);
    drawRabbit(g, escape ? escape.x : 600, MEADOW_Y - 74, 'peek');
  } else {
    drawRabbit(g, RABBIT_HOME.x, RABBIT_HOME.y, 'out');
  }

  // 危险：狐狸蹲在第一个被守住的洞口，老鹰守在第二个洞口上方
  state.blocked.forEach((id, index) => {
    const spot = spots.find((item) => item.id === id);
    if (!spot) return;
    if (index === 0) drawFox(g, spot.x + 108, MEADOW_Y - 10);
    else drawHawk(g, spot.x, MEADOW_Y - 210);
  });
}

/** 收尾：三个洞口都开着，兔子在窝里睡着 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  spots: BurrowSpot[],
): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(375, 900, 380);
  for (const spot of spots) {
    g.lineStyle(8, THEME.gold, 0.55);
    g.strokeEllipse(spot.x, MEADOW_Y + 6, 150, 70);
  }
}

/** 分幕插图：① 草地上的兔子与天上的鹰 ② 冯谖对孟尝君说话 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.leaf, 1);
  g.fillRoundedRect(x - 20, y + h * 0.66, w + 40, h * 0.38, 30);

  if (index === 0) {
    drawRabbit(g, x + w * 0.46, y + h * 0.7, 'out');
    drawHawk(g, x + w * 0.7, y + h * 0.24);
  } else {
    // 冯谖与孟尝君：两个人，一个说、一个听
    const pair = [[x + w * 0.34, THEME.teal], [x + w * 0.64, THEME.red]] as const;
    for (const [px, color] of pair) {
      groundShadow(g, px, y + h * 0.82, 120, 30, 0.16);
      roundRect(g, px - 40, y + h * 0.52, 80, 150, 30, color, THEME.outline, 6);
      circle(g, px, y + h * 0.45, 34, 0xf6d3ae, THEME.outline, 6);
      g.fillStyle(THEME.ink, 1);
      g.fillEllipse(px, y + h * 0.4, 70, 30);
    }
    g.fillStyle(THEME.wood, 1);
    roundRect(g, x + w * 0.44, y + h * 0.66, 60, 44, 12, THEME.wood, THEME.outline, 5);
  }
}
