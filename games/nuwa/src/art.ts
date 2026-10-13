import type Phaser from 'phaser';
import { THEME, circle, roundRect, shade } from '@chags/phaser-kit';

/** 五色石：青、赤、黄、白、紫 —— 颜色只是好看，判定靠形状（色弱的孩子也能玩） */
const COLORS: Record<string, number> = {
  round: 0x3d8f86,
  square: 0xe0554a,
  triangle: 0xf2b134,
  diamond: 0xfffaf0,
  star: 0x8b5fbf,
};

const SIZE = 52;

function shape(g: Phaser.GameObjects.Graphics, kind: string, x: number, y: number): void {
  switch (kind) {
    case 'round':
      g.fillCircle(x, y, SIZE);
      break;
    case 'square':
      g.fillRoundedRect(x - SIZE, y - SIZE, SIZE * 2, SIZE * 2, 16);
      break;
    case 'triangle':
      g.fillTriangle(x, y - SIZE - 6, x + SIZE, y + SIZE * 0.8, x - SIZE, y + SIZE * 0.8);
      break;
    case 'diamond':
      g.beginPath();
      g.moveTo(x, y - SIZE - 6);
      g.lineTo(x + SIZE, y);
      g.lineTo(x, y + SIZE + 6);
      g.lineTo(x - SIZE, y);
      g.closePath();
      g.fillPath();
      break;
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? SIZE + 8 : (SIZE + 8) * 0.45;
        const angle = -Math.PI / 2 + (Math.PI * i) / 5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
      break;
    }
    default:
      g.fillCircle(x, y, SIZE);
      break;
  }
}

function outline(g: Phaser.GameObjects.Graphics, kind: string, x: number, y: number): void {
  g.lineStyle(6, THEME.outline, 1);
  switch (kind) {
    case 'round':
      g.strokeCircle(x, y, SIZE);
      break;
    case 'square':
      g.strokeRoundedRect(x - SIZE, y - SIZE, SIZE * 2, SIZE * 2, 16);
      break;
    case 'triangle':
      g.strokeTriangle(x, y - SIZE - 6, x + SIZE, y + SIZE * 0.8, x - SIZE, y + SIZE * 0.8);
      break;
    case 'diamond':
      g.beginPath();
      g.moveTo(x, y - SIZE - 6);
      g.lineTo(x + SIZE, y);
      g.lineTo(x, y + SIZE + 6);
      g.lineTo(x - SIZE, y);
      g.closePath();
      g.strokePath();
      break;
    case 'star':
      g.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? SIZE + 8 : (SIZE + 8) * 0.45;
        const angle = -Math.PI / 2 + (Math.PI * i) / 5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
      break;
    default:
      g.strokeCircle(x, y, SIZE);
      break;
  }
}

/** 天上的破洞：没补上时是深色的轮廓，补上之后亮起来 */
export function drawPiece(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
  filled: boolean,
): void {
  if (!filled) {
    g.fillStyle(0x191333, 0.9);
    shape(g, kind, x, y);
    g.lineStyle(6, 0x9b8ec7, 0.9);
    outline(g, kind, x, y);
    return;
  }

  const color = COLORS[kind] ?? THEME.gold;
  // 补好之后透出的光
  g.fillStyle(color, 0.28);
  g.fillCircle(x, y, SIZE * 1.7);
  g.fillStyle(color, 1);
  shape(g, kind, x, y);
  outline(g, kind, x, y);
}

/** 五色石（可指定位置） */
export function drawStoneAt(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
): void {
  const color = COLORS[kind] ?? THEME.gold;
  g.fillStyle(color, 0.26);
  g.fillCircle(x, y, 68);
  g.fillStyle(color, 1);
  shape(g, kind, x, y);
  outline(g, kind, x, y);
}

/** 托盘里的五色石：模板要求画在容器原点 */
export function drawOrb(g: Phaser.GameObjects.Graphics, kind: string): void {
  drawStoneAt(g, kind, 0, 0);
}

/** 补完天：五色霞光从五个洞里洒下来 */
export function drawFinale(g: Phaser.GameObjects.Graphics, placedIds: string[]): void {
  const spots: Record<string, [number, number]> = {
    'hole-round': [165, 330],
    'hole-square': [395, 250],
    'hole-triangle': [615, 330],
    'hole-diamond': [255, 530],
    'hole-star': [535, 530],
  };
  for (const id of placedIds) {
    const spot = spots[id];
    if (!spot) continue;
    const [x, y] = spot;
    const kind = id.replace('hole-', '');
    const color = COLORS[kind] ?? THEME.gold;
    g.fillStyle(color, 0.22);
    g.fillTriangle(x - 90, y, x + 90, y, x, y + 620);
  }
}

/** 分幕插图 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(index === 0 ? 0x2b2450 : THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(0xd9c08a, 1);
  g.fillRect(x, y + h - 130, w, 130);

  const holes = [
    [0.25, 0.28, 'round'],
    [0.55, 0.2, 'square'],
    [0.78, 0.32, 'triangle'],
  ] as const;
  for (const [rx, ry, kind] of holes) {
    drawPiece(g, kind, x + w * rx, y + h * ry, index !== 0);
  }

  if (index === 1) {
    // 女娲：蛇尾人身，托着石头
    circle(g, x + 150, y + h - 300, 34, 0xf6d3ae, THEME.outline, 6);
    roundRect(g, x + 118, y + h - 260, 64, 120, 26, THEME.red, THEME.outline, 6);
    g.fillStyle(shade(THEME.red, 0.85), 1);
    g.fillEllipse(x + 150, y + h - 110, 130, 70);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeEllipse(x + 150, y + h - 110, 130, 70);
    drawStoneAt(g, 'star', x + 150, y + h - 400);
  }
}
