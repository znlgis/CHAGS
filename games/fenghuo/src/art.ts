import type Phaser from 'phaser';
import { THEME, circle, roundRect, shade } from '@chags/phaser-kit';
import type { BeaconTower } from '@chags/templates';

/** 夜戏用的一套颜色：比主题色更暗，火光才跳得出来 */
export const NIGHT = {
  skyTop: 0x141a33,
  skyMid: 0x22304f,
  skyLow: 0x3b4a6b,
  hillFar: 0x2b3a5c,
  hill: 0x1d2740,
  ridge: 0x2f3f5e,
  ridgeTop: 0x3d5273,
  stone: 0x6d6a63,
  stoneDeep: 0x4a4843,
  wall: 0x8a7f6d,
  wallDeep: 0x6b6154,
  flame: 0xf59b3c,
  flameHot: 0xffe08a,
  ember: 0xf2b134,
  smoke: 0x59637a,
  robe: 0xb46a86,
} as const;

/** 山脊在某个 x 处的高度（烽火台就站在它上面） */
export function ridgeY(x: number): number {
  return 960 - (x / 750) * 400;
}

/** 夜空 + 星星 + 月亮：星星按索引用正弦轻闪，画面稳（不用随机数） */
export function drawSky(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(NIGHT.skyTop, 1);
  g.fillRect(0, 150, 750, 300);
  g.fillStyle(NIGHT.skyMid, 1);
  g.fillRect(0, 440, 750, 240);
  g.fillStyle(NIGHT.skyLow, 1);
  g.fillRect(0, 670, 750, 700);

  for (let i = 0; i < 44; i += 1) {
    const x = 16 + ((i * 97) % 718);
    const y = 176 + ((i * 53) % 400);
    const twinkle = 0.45 + 0.45 * Math.sin(t / 620 + i * 1.7);
    g.fillStyle(0xfff6dd, twinkle);
    g.fillCircle(x, y, 2 + (i % 3));
  }
  // 月亮
  g.fillStyle(0xf7f2e6, 0.16);
  g.fillCircle(148, 250, 74);
  circle(g, 148, 250, 46, 0xf7f2e6, null, 0);
  g.fillStyle(NIGHT.skyTop, 0.28);
  g.fillCircle(168, 238, 12);
}

export function drawHills(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(NIGHT.hillFar, 1);
  g.fillTriangle(-40, 800, 190, 574, 420, 800);
  g.fillTriangle(300, 800, 540, 620, 790, 800);
  g.fillStyle(NIGHT.hill, 1);
  g.beginPath();
  g.moveTo(0, ridgeY(0));
  g.lineTo(750, ridgeY(750));
  g.lineTo(750, 1334);
  g.lineTo(0, 1334);
  g.closePath();
  g.fillPath();
  g.lineStyle(7, NIGHT.ridgeTop, 1);
  g.beginPath();
  g.moveTo(0, ridgeY(0));
  g.lineTo(750, ridgeY(750));
  g.strokePath();
}

/** 烽火台：石头台子 + 顶上的火盆。lit 时火光跳动 */
export function drawTower(
  g: Phaser.GameObjects.Graphics,
  tower: BeaconTower,
  lit: boolean,
  t: number,
): void {
  const { x, y } = tower;
  g.fillStyle(0x1b2136, 0.5);
  g.fillEllipse(x, y + 8, 108, 26);
  roundRect(g, x - 34, y - 86, 68, 92, 8, NIGHT.stone, NIGHT.stoneDeep, 6);
  roundRect(g, x - 42, y - 100, 84, 18, 7, shade(NIGHT.stone, 1.1), NIGHT.stoneDeep, 5);
  for (let i = 0; i < 3; i += 1) {
    roundRect(g, x - 36 + i * 26, y - 112, 22, 14, 4, NIGHT.stoneDeep, null, 0);
  }
  // 火盆
  g.fillStyle(NIGHT.stoneDeep, 1);
  g.fillTriangle(x - 26, y - 112, x + 26, y - 112, x + 18, y - 128);
  g.fillTriangle(x - 26, y - 112, x - 18, y - 128, x + 18, y - 128);
  if (!lit) return;

  const flicker = 0.9 + 0.18 * Math.sin(t / 90 + x);
  g.fillStyle(NIGHT.flame, 0.16);
  g.fillCircle(x, y - 132, 52 * flicker);
  g.fillStyle(NIGHT.flame, 1);
  g.fillTriangle(x - 22, y - 118, x + 22, y - 118, x, y - 186 * flicker);
  g.fillStyle(NIGHT.flameHot, 1);
  g.fillTriangle(x - 11, y - 118, x + 11, y - 118, x, y - 150 * flicker);
  // 火星往天上飘
  for (let i = 0; i < 3; i += 1) {
    const rise = ((t / 5 + i * 60) % 180) / 180;
    g.fillStyle(NIGHT.ember, 0.9 - rise * 0.9);
    g.fillCircle(x + Math.sin(t / 300 + i) * 18, y - 140 - rise * 120, 4 + i);
  }
}

/** 城墙、城门与城楼；smile 是褒姒笑的强度 0..1 */
export function drawWall(g: Phaser.GameObjects.Graphics, smile: number, t: number): void {
  roundRect(g, -20, 1010, 470, 340, 10, NIGHT.wall, NIGHT.wallDeep, 7);
  for (let i = 0; i < 7; i += 1) {
    roundRect(g, -10 + i * 68, 976, 46, 40, 6, NIGHT.wall, NIGHT.wallDeep, 6);
  }
  // 城门
  g.fillStyle(0x231a18, 1);
  g.fillRoundedRect(96, 1080, 120, 200, { tl: 58, tr: 58, bl: 0, br: 0 });
  g.lineStyle(7, NIGHT.wallDeep, 1);
  g.strokeRoundedRect(96, 1080, 120, 200, { tl: 58, tr: 58, bl: 0, br: 0 });
  // 城楼平台
  roundRect(g, 42, 928, 200, 58, 10, shade(NIGHT.wall, 1.06), NIGHT.wallDeep, 7);
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle(NIGHT.wallDeep, 1);
    g.fillRect(52 + i * 42, 906, 12, 26);
  }

  // 褒姒：坐在城楼上
  const cx = 142;
  const headY = 866;
  g.fillStyle(NIGHT.robe, 1);
  g.beginPath();
  g.moveTo(cx - 44, headY + 92);
  g.lineTo(cx + 44, headY + 92);
  g.lineTo(cx + 26, headY + 20);
  g.lineTo(cx - 26, headY + 20);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  circle(g, cx, headY, 30, 0xf6d3ae, THEME.outline, 5);
  g.fillStyle(0x2b2334, 1);
  g.fillCircle(cx, headY - 30, 15);
  g.fillCircle(cx - 23, headY - 17, 8);
  g.fillCircle(cx + 23, headY - 17, 8);

  // 表情：这就是全场唯一会变的东西
  const eyeY = headY + 5;
  g.fillStyle(THEME.outline, 1);
  if (smile > 0.4) {
    g.lineStyle(5, THEME.outline, 1);
    g.beginPath();
    g.moveTo(cx - 16, eyeY);
    g.lineTo(cx - 6, eyeY - 7);
    g.lineTo(cx + 4, eyeY);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + 4, eyeY);
    g.lineTo(cx + 14, eyeY - 7);
    g.lineTo(cx + 24, eyeY);
    g.strokePath();
  } else {
    g.fillCircle(cx - 13, eyeY, 5);
    g.fillCircle(cx + 13, eyeY, 5);
  }
  g.lineStyle(5, 0x8c4a3f, 1);
  g.beginPath();
  if (smile > 0.4) {
    g.moveTo(cx - 16, headY + 22);
    g.lineTo(cx, headY + 38);
    g.lineTo(cx + 16, headY + 22);
  } else {
    g.moveTo(cx - 12, headY + 26);
    g.lineTo(cx + 12, headY + 26);
  }
  g.strokePath();

  if (smile > 0.05) {
    g.fillStyle(0xe78aa2, 0.5 * smile);
    g.fillCircle(cx - 19, headY + 14, 8);
    g.fillCircle(cx + 19, headY + 14, 8);
    for (let i = 0; i < 5; i += 1) {
      const a = t / 500 + (i * Math.PI * 2) / 5;
      g.fillStyle(NIGHT.flameHot, 0.75 * smile);
      g.fillCircle(cx + Math.cos(a) * 70, headY + Math.sin(a) * 46, 7);
    }
  }
}

/** 信任：一盏一盏的灯，点一次灭一盏 */
export function drawTrust(g: Phaser.GameObjects.Graphics, remaining: number, total: number): void {
  const x0 = 700 - (total - 1) * 58;
  for (let i = 0; i < total; i += 1) {
    const x = x0 + i * 58;
    const alive = i < remaining;
    g.fillStyle(alive ? NIGHT.flame : 0x2a3350, 1);
    g.fillCircle(x, 206, 17);
    g.lineStyle(5, alive ? NIGHT.flameHot : 0x46527a, 1);
    g.strokeCircle(x, 206, 17);
    if (alive) {
      g.fillStyle(NIGHT.flameHot, 1);
      g.fillTriangle(x - 7, 212, x + 7, 212, x, 194);
    }
    g.fillStyle(0x46527a, 1);
    g.fillRect(x - 3, 222, 6, 20);
  }
}

/** 赶来的兵马：剪影 + 火把 */
export function drawRiders(
  g: Phaser.GameObjects.Graphics,
  riders: { x: number; y: number; dir: number; s: number }[],
): void {
  for (const rider of riders) {
    const { x, y, dir, s } = rider;
    const tx = x + 34 * dir * s;
    const ty = y - 100 * s;
    // 火把先把人和马照亮一圈，剪影才不会糊在夜色里
    g.fillStyle(NIGHT.flame, 0.14);
    g.fillCircle(tx, ty, 66 * s);
    g.fillStyle(0x141a2c, 0.45);
    g.fillEllipse(x, y + 12 * s, 138 * s, 28 * s);
    g.lineStyle(4 * s, 0x4a5772, 1);
    g.fillStyle(0x2a3346, 1);
    g.fillEllipse(x, y - 30 * s, 104 * s, 50 * s);
    g.strokeEllipse(x, y - 30 * s, 104 * s, 50 * s);
    g.fillEllipse(x + 44 * dir * s, y - 54 * s, 38 * s, 50 * s);
    g.strokeEllipse(x + 44 * dir * s, y - 54 * s, 38 * s, 50 * s);
    g.fillStyle(0x2a3346, 1);
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(x - 36 * s + i * 24 * s, y - 8 * s, 10 * s, 34 * s);
    }
    // 骑手
    g.fillStyle(0x39425c, 1);
    g.fillEllipse(x - 8 * dir * s, y - 84 * s, 38 * s, 46 * s);
    g.lineStyle(4 * s, 0x5a6b8a, 1);
    g.fillCircle(x - 8 * dir * s, y - 112 * s, 16 * s);
    g.strokeCircle(x - 8 * dir * s, y - 112 * s, 16 * s);
    g.fillStyle(NIGHT.flame, 0.35);
    g.fillCircle(tx, ty, 30 * s);
    g.fillStyle(NIGHT.flame, 1);
    g.fillTriangle(tx - 9 * s, ty + 9 * s, tx + 9 * s, ty + 9 * s, tx, ty - 20 * s);
  }
}

/** 真的狼来了：天边的烟与火光 */
export function drawSmoke(g: Phaser.GameObjects.Graphics, t: number, strength: number): void {
  if (strength <= 0) return;
  g.fillStyle(NIGHT.flame, 0.3 * strength);
  g.fillCircle(700, 540, 110 * strength);
  for (let i = 0; i < 6; i += 1) {
    const rise = ((t / 9 + i * 70) % 300) / 300;
    g.fillStyle(0x39415a, (0.62 - rise * 0.5) * strength);
    g.fillCircle(692 + Math.sin(t / 700 + i) * 40, 560 - rise * 380, 30 + rise * 86);
  }
}

/** 分幕插图 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(NIGHT.skyTop, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(NIGHT.skyMid, 1);
  g.fillRect(x, y + h * 0.5, w, h * 0.5);
  g.fillStyle(NIGHT.hill, 1);
  g.fillTriangle(x, y + h, x + w * 0.45, y + h * 0.45, x + w, y + h);

  for (let i = 0; i < 3; i += 1) {
    const tx = x + 130 + i * 190;
    const ty = y + h - 150 + i * 40;
    drawTower(g, { id: 'b' + i, x: tx, y: ty }, index === 0, i * 300);
  }

  if (index === 1) {
    // 城楼上的褒姒与点火的幽王
    roundRect(g, x + 60, y + h - 120, 300, 120, 12, NIGHT.wall, NIGHT.wallDeep, 6);
    g.fillStyle(NIGHT.robe, 1);
    g.fillTriangle(x + 130, y + h - 120, x + 200, y + h - 120, x + 165, y + h - 210);
    circle(g, x + 165, y + h - 220, 24, 0xf6d3ae, THEME.outline, 5);
    g.fillStyle(0x2b2334, 1);
    g.fillCircle(x + 165, y + h - 240, 15);
    g.fillStyle(THEME.redDeep, 1);
    g.fillTriangle(x + 300, y + h - 120, x + 370, y + h - 120, x + 335, y + h - 230);
    circle(g, x + 335, y + h - 244, 26, 0xf6d3ae, THEME.outline, 5);
    g.fillStyle(0x2b2334, 1);
    g.fillCircle(x + 335, y + h - 266, 16);
  }
}
