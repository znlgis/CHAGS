import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';

const SEA_TOP = 700;
const SHORE_X = 150;
const ISLAND_X = 470;
const ISLAND_Y = 880;

/** 精卫：一只小小的鸟，翅膀随飞行上下扇动 */
export function drawBird(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  flap: number,
): void {
  const lift = Math.sin(flap * Math.PI * 2) * 10;
  g.fillStyle(0xfffaf0, 1);
  g.fillEllipse(x, y, 54, 34);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x, y, 54, 34);

  // 翅膀
  g.fillStyle(0xf0e0bd, 1);
  g.fillTriangle(x - 6, y - 6, x + 22, y - 34 - lift, x + 30, y - 2);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 6, y - 6, x + 22, y - 34 - lift, x + 30, y - 2);

  // 头与喙
  circle(g, x - 26, y - 12, 15, 0xfffaf0, THEME.outline, 5);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x - 40, y - 14, x - 56, y - 9, x - 40, y - 4);
  g.lineStyle(4, THEME.outline, 1);
  g.strokeTriangle(x - 40, y - 14, x - 56, y - 9, x - 40, y - 4);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 30, y - 16, 3);
}

/** 分幕插图：海、岸、小鸟 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.water, 1);
  g.fillRect(x, y + h * 0.52, w, h * 0.48);
  g.fillStyle(THEME.sand, 1);
  g.fillRoundedRect(x - 20, y + h * 0.62, w * 0.42, h * 0.4, 30);

  if (index === 0) {
    // 女娃站在海边
    circle(g, x + 120, y + h * 0.56, 30, 0xf6d3ae, THEME.outline, 6);
    roundRect(g, x + 90, y + h * 0.6, 60, 96, 24, THEME.red, THEME.outline, 6);
    g.fillStyle(THEME.ink, 1);
    for (let i = -2; i <= 2; i += 1) g.fillCircle(x + 120 + i * 11, y + h * 0.52, 8);
  } else {
    // 精卫衔石
    drawBird(g, x + w * 0.5, y + h * 0.3, 0.25);
    g.fillStyle(THEME.stone, 1);
    g.fillCircle(x + w * 0.5 - 46, y + h * 0.32, 12);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeCircle(x + w * 0.5 - 46, y + h * 0.32, 12);
  }
}

export interface JingweiStage {
  width: number;
  height: number;
  eased: number;
}

/** 场景：左边是岸，右边是海，海里的小岛随着进度长大 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: JingweiStage,
  timeMs: number,
): void {
  // 天与海
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, stage.width, SEA_TOP - 150);
  g.fillStyle(THEME.water, 1);
  g.fillRect(0, SEA_TOP, stage.width, stage.height - SEA_TOP);
  g.fillStyle(THEME.waterDeep, 0.45);
  g.fillRect(0, stage.height - 140, stage.width, 140);

  // 海面波纹
  g.lineStyle(5, 0xffffff, 0.5);
  for (const [wy, amp] of [[SEA_TOP + 40, 8], [SEA_TOP + 150, 10], [SEA_TOP + 280, 8]] as const) {
    g.beginPath();
    g.moveTo(0, wy);
    for (let i = 0; i <= 20; i += 1) {
      g.lineTo((stage.width * i) / 20, wy + Math.sin((i / 20) * Math.PI * 4 + timeMs / 600) * amp);
    }
    g.strokePath();
  }

  // 左边的岸
  roundRect(g, -40, SEA_TOP - 60, 260, stage.height - SEA_TOP + 120, { tl: 0, tr: 70, bl: 0, br: 70 }, THEME.sand, THEME.outline, 7);
  // 岸上的石堆
  g.fillStyle(THEME.stone, 1);
  for (const [sx, sy, r] of [[70, 800, 20], [110, 826, 16], [56, 840, 14], [126, 792, 13]] as const) {
    g.fillCircle(sx, sy, r);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeCircle(sx, sy, r);
  }

  // 海里长大的小岛 —— 这就是"填"出来的那一块
  const rx = 26 + stage.eased * 128;
  const ry = 10 + stage.eased * 42;
  groundShadow(g, ISLAND_X, ISLAND_Y + ry + 6, rx * 2, ry, 0.14);
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillEllipse(ISLAND_X, ISLAND_Y, rx * 2, ry * 2);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(ISLAND_X, ISLAND_Y, rx * 2, ry * 2);
  if (stage.eased > 0.25) {
    g.fillStyle(THEME.leaf, 1);
    for (const dx of [-0.4, 0, 0.4] as const) {
      g.fillCircle(ISLAND_X + rx * dx, ISLAND_Y - ry * 0.7, 6 + stage.eased * 8);
    }
  }

  // 精卫一直在飞：岸 → 岛 → 岸
  const period = 1900;
  const phase = (timeMs % period) / period;
  const t = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const bx = SHORE_X + (ISLAND_X - SHORE_X) * t;
  const by = SEA_TOP - 130 - Math.sin(t * Math.PI) * 90;
  drawBird(g, bx, by, phase * 6);
}

/** 收尾：小岛成形，精卫还在飞 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.22);
  g.fillCircle(ISLAND_X, ISLAND_Y, 190);
}
