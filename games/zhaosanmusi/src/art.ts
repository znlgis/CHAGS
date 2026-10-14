import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { SplitStageState } from '@chags/templates';
import { GROUND_TOP, KEEPER, LEFT_X, MONKEY_Y, RIGHT_X, ROPE_Y, SKY_TOP } from './layout';

/** 橡子：一颗圆圆的果子，顶上一顶小帽子 */
export function drawAcorn(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  filled: boolean,
): void {
  if (!filled) return;
  g.fillStyle(0xd9a05b, 1);
  g.fillEllipse(x, y, 46, 54);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x, y, 46, 54);
  roundRect(g, x - 26, y - 34, 52, 22, 9, THEME.woodDeep, THEME.outline, 5);
  g.lineStyle(5, THEME.woodDeep, 1);
  g.lineBetween(x, y - 34, x + 8, y - 46);
}

export type MonkeyMood = 'happy' | 'angry' | 'hungry';

/** 一只小猴子：高兴就举手跳，生气就张嘴叫，饿着就耷拉着脑袋 */
export function drawMonkey(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  mood: MonkeyMood,
): void {
  const jump = mood === 'happy' ? -14 : 0;
  const cy = y + jump;
  groundShadow(g, x, y + 74, 96, 26, 0.16);

  // 尾巴
  g.lineStyle(9, 0x8a5a34, 1);
  g.beginPath();
  g.moveTo(x + 34, cy + 30);
  g.lineTo(x + 74, cy + 40);
  g.lineTo(x + 86, cy + 8);
  g.strokePath();

  // 身体
  g.fillStyle(0xa9713f, 1);
  g.fillEllipse(x, cy + 26, 78, 92);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, cy + 26, 78, 92);
  g.fillStyle(0xf0d3ac, 1);
  g.fillEllipse(x, cy + 32, 46, 58);

  // 手
  g.lineStyle(11, 0xa9713f, 1);
  if (mood === 'happy') {
    g.lineBetween(x - 34, cy + 6, x - 46, cy - 46);
    g.lineBetween(x + 34, cy + 6, x + 46, cy - 46);
  } else if (mood === 'angry') {
    g.lineBetween(x - 34, cy + 10, x - 52, cy - 30);
    g.lineBetween(x + 34, cy + 10, x + 52, cy - 30);
  } else {
    g.lineBetween(x - 34, cy + 20, x - 44, cy + 52);
    g.lineBetween(x + 34, cy + 20, x + 44, cy + 52);
  }

  // 耳朵
  circle(g, x - 40, cy - 34, 17, 0xa9713f, THEME.outline, 5);
  circle(g, x + 40, cy - 34, 17, 0xa9713f, THEME.outline, 5);

  // 头
  circle(g, x, cy - 36, 42, 0xa9713f, THEME.outline, 6);
  g.fillStyle(0xf0d3ac, 1);
  g.fillEllipse(x, cy - 26, 58, 48);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x, cy - 26, 58, 48);

  // 眼睛
  g.fillStyle(THEME.outline, 1);
  if (mood === 'hungry') {
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(x - 22, cy - 40, x - 6, cy - 40);
    g.lineBetween(x + 6, cy - 40, x + 22, cy - 40);
  } else {
    g.fillCircle(x - 14, cy - 40, 6);
    g.fillCircle(x + 14, cy - 40, 6);
  }

  // 嘴
  if (mood === 'happy') {
    g.lineStyle(5, THEME.outline, 1);
    g.beginPath();
    g.moveTo(x - 14, cy - 16);
    g.lineTo(x, cy - 6);
    g.lineTo(x + 14, cy - 16);
    g.strokePath();
  } else if (mood === 'angry') {
    g.fillStyle(0x7a3b32, 1);
    g.fillEllipse(x, cy - 14, 26, 22);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeEllipse(x, cy - 14, 26, 22);
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(x - 26, cy - 62, x - 8, cy - 52);
    g.lineBetween(x + 26, cy - 62, x + 8, cy - 52);
  } else {
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(x - 12, cy - 14, x + 12, cy - 14);
  }
}

/** 狙公：抱着装橡子的竹筐 */
function drawKeeper(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 96, 110, 28, 0.16);
  roundRect(g, x - 34, y - 10, 68, 104, 26, THEME.teal, THEME.outline, 6);
  circle(g, x, y - 44, 30, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 62, 62, 26);
  g.fillCircle(x - 10, y - 44, 4);
  g.fillCircle(x + 10, y - 44, 4);
  roundRect(g, x + 26, y + 10, 56, 46, 14, THEME.wood, THEME.outline, 5);
  g.fillStyle(0xd9a05b, 1);
  for (const dx of [-14, 0, 14] as const) g.fillCircle(x + 54 + dx, y + 12, 8);
}

function drawPost(g: Phaser.GameObjects.Graphics, x: number): void {
  roundRect(g, x - 16, ROPE_Y - 10, 32, GROUND_TOP - ROPE_Y + 60, 12, THEME.woodDeep, THEME.outline, 6);
}

/** 整屏世界：天、地、草绳两端的木桩、狙公、树下的猴子 */
export function drawWorld(g: Phaser.GameObjects.Graphics, state: SplitStageState): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  const night = state.greedy;

  g.fillStyle(night ? 0x2f3b6b : THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, GROUND_TOP - SKY_TOP);
  if (night) {
    circle(g, 596, 246, 46, 0xfdf3dc, null, 0);
    g.fillStyle(0xfdf3dc, 1);
    for (const [sx, sy, r] of [[140, 250, 6], [230, 200, 4], [420, 300, 5], [520, 370, 4]] as const) {
      g.fillCircle(sx, sy, r);
    }
  }

  // 地面
  roundRect(
    g, -40, GROUND_TOP, W + 80, H - GROUND_TOP + 40,
    { tl: 80, tr: 80, bl: 0, br: 0 }, night ? 0x6f7f63 : THEME.leaf, THEME.outline, 7,
  );
  g.fillStyle(night ? 0x5d6b53 : shade(THEME.leaf, 0.88), 1);
  g.fillRect(-40, GROUND_TOP + 70, W + 80, H - GROUND_TOP);

  // 草绳两端的木桩
  drawPost(g, LEFT_X);
  drawPost(g, RIGHT_X);

  drawKeeper(g, KEEPER.x, KEEPER.y);

  // 树下五只猴子：它们只看"早上"那一头
  const mood: MonkeyMood = state.greedy ? 'hungry' : state.mood;
  for (let i = 0; i < 5; i += 1) {
    const x = 190 + i * 108;
    const y = MONKEY_Y + (i % 2 === 0 ? 0 : 22);
    drawMonkey(g, x, y, mood);
  }
}

/** 收尾：把"刚才那种分法"的虚影摆出来 —— 同样的七颗，只是木牌挪了一下 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  initialLeft: number,
  total: number,
): void {
  const gap = (RIGHT_X - LEFT_X) / total;
  g.fillStyle(THEME.gold, 0.18);
  g.fillCircle((LEFT_X + RIGHT_X) / 2, ROPE_Y, 300);

  // 上面一条虚影：原文的"朝三暮四"
  g.lineStyle(6, THEME.outline, 0.28);
  g.lineBetween(LEFT_X, ROPE_Y - 250, RIGHT_X, ROPE_Y - 250);
  for (let i = 0; i < total; i += 1) {
    const x = LEFT_X + gap * (i + 0.5);
    g.fillStyle(THEME.outline, 0.22);
    g.fillCircle(x, ROPE_Y - 274, 20);
  }
  g.lineStyle(8, THEME.outline, 0.4);
  g.lineBetween(LEFT_X + gap * initialLeft, ROPE_Y - 300, LEFT_X + gap * initialLeft, ROPE_Y - 200);
}

/** 分幕插图：① 狙公抱着筐跟猴子商量 ② 猴子一会儿闹一会儿笑 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.leaf, 1);
  g.fillRoundedRect(x - 20, y + h * 0.68, w + 40, h * 0.36, 30);

  if (index === 0) {
    drawKeeper(g, x + w * 0.32, y + h * 0.46);
    for (let i = 0; i < 3; i += 1) {
      drawMonkey(g, x + w * 0.6 + i * 0.13 * w, y + h * 0.5 + (i % 2) * 24, 'angry');
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      drawMonkey(g, x + w * 0.24 + i * 0.17 * w, y + h * 0.52 + (i % 2) * 20, 'happy');
    }
    g.fillStyle(0xd9a05b, 1);
    for (const [dx, dy] of [[-18, 0], [0, -14], [18, 0]] as const) {
      g.fillCircle(x + w * 0.5 + dx, y + h * 0.22 + dy, 11);
    }
  }
}
