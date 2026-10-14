import type Phaser from 'phaser';
import { THEME, circle, roundRect, shade } from '@chags/phaser-kit';
import type { SortBin, SortItem, SortItemState } from '@chags/templates';

export type Mood = 'idle' | 'sweet' | 'cure' | 'poison';

const SKIN = 0xf6d3ae;
const ROBE = 0x6fa86a;
const SOIL = 0xd9c08a;
const FIELD = 0xbfe3a4;

/** 用折线逼近一段圆弧：Phaser 的 Graphics 在不同版本里 arc 行为不一致，自己画最稳 */
function strokeArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  width: number = 6,
  color: number = THEME.outline,
  steps = 14,
): void {
  g.lineStyle(width, color, 1);
  g.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

/** 还没尝过的草上顶着一个问号：不知道是什么，先尝一口 */
function questionBubble(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  circle(g, x, y, r, THEME.card, THEME.outline, 5);
  // 一个真正的"?"：从碗的左下绕过顶部到右上，再落下来一点，最后是一个点
  strokeArc(g, x, y - r * 0.16, r * 0.46, Math.PI * 0.85, Math.PI * 1.85, 6, THEME.inkSoft);
  g.lineStyle(6, THEME.inkSoft, 1);
  g.lineBetween(x + r * 0.42, y - r * 0.25, x + r * 0.04, y + r * 0.22);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillCircle(x + r * 0.02, y + r * 0.58, r * 0.14);
}

// ---------- 神农 ----------

function face(g: Phaser.GameObjects.Graphics, cx: number, cy: number, mood: Mood): void {
  const eyeY = cy - 8;
  g.fillStyle(THEME.outline, 1);
  if (mood === 'sweet') {
    // 眯成两条弯弯的线
    strokeArc(g, cx - 24, eyeY + 6, 13, Math.PI * 1.15, Math.PI * 1.85, 5);
    strokeArc(g, cx + 24, eyeY + 6, 13, Math.PI * 1.15, Math.PI * 1.85, 5);
  } else if (mood === 'poison') {
    // 眼睛转圈：画两个小叉
    for (const dx of [-24, 24]) {
      g.lineStyle(5, THEME.outline, 1);
      g.lineBetween(cx + dx - 9, eyeY - 9, cx + dx + 9, eyeY + 9);
      g.lineBetween(cx + dx + 9, eyeY - 9, cx + dx - 9, eyeY + 9);
    }
  } else {
    g.fillCircle(cx - 24, eyeY, 7);
    g.fillCircle(cx + 24, eyeY, 7);
  }

  // 嘴
  if (mood === 'sweet') {
    g.fillStyle(0x8c4a3f, 1);
    g.fillEllipse(cx, cy + 22, 40, 30);
    g.fillStyle(THEME.card, 1);
    g.fillRect(cx - 16, cy + 8, 32, 9);
  } else if (mood === 'cure') {
    circle(g, cx, cy + 22, 11, 0x8c4a3f, THEME.outline, 4);
  } else if (mood === 'poison') {
    g.lineStyle(6, THEME.outline, 1);
    g.beginPath();
    g.moveTo(cx - 22, cy + 24);
    g.lineTo(cx - 8, cy + 16);
    g.lineTo(cx + 8, cy + 26);
    g.lineTo(cx + 22, cy + 18);
    g.strokePath();
  } else {
    strokeArc(g, cx, cy + 12, 20, Math.PI * 0.18, Math.PI * 0.82, 5);
  }
}

/** 神农：白胡子、绿衣裳、背着一个竹筐 */
function drawShennong(g: Phaser.GameObjects.Graphics, mood: Mood): void {
  const cx = 375;
  const headY = 252;
  const headR = 66;

  // 竹筐（背在身后）
  roundRect(g, cx + 52, headY + 150, 108, 118, 22, 0xdcb26a, THEME.woodDeep, 6);
  g.lineStyle(4, shade(THEME.woodDeep, 1.1), 1);
  for (let i = 1; i < 4; i += 1) {
    g.lineBetween(cx + 60, headY + 150 + i * 28, cx + 152, headY + 150 + i * 28);
  }
  g.fillStyle(THEME.leaf, 1);
  g.fillEllipse(cx + 96, headY + 140, 44, 78);
  g.fillEllipse(cx + 132, headY + 152, 36, 62);

  // 身体
  g.fillStyle(THEME.outline, 0.16);
  g.fillEllipse(cx, headY + 470, 210, 40);
  g.beginPath();
  g.moveTo(cx - 52, headY + 120);
  g.lineTo(cx + 52, headY + 120);
  g.lineTo(cx + 96, headY + 330);
  g.lineTo(cx - 96, headY + 330);
  g.closePath();
  g.fillStyle(ROBE, 1);
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();

  // 手臂
  roundRect(g, cx - 116, headY + 130, 46, 150, 22, ROBE, THEME.outline, 6);
  roundRect(g, cx + 70, headY + 130, 46, 150, 22, ROBE, THEME.outline, 6);
  // 两只脚
  roundRect(g, cx - 66, headY + 318, 54, 30, 15, 0x8a6a2f, THEME.outline, 6);
  roundRect(g, cx + 12, headY + 318, 54, 30, 15, 0x8a6a2f, THEME.outline, 6);

  // 头
  circle(g, cx, headY, headR, SKIN, THEME.outline, 6);
  // 头发与发髻
  g.fillStyle(0x3a2f26, 1);
  g.beginPath();
  g.moveTo(cx - headR, headY - headR * 0.3);
  g.lineTo(cx + headR, headY - headR * 0.3);
  g.lineTo(cx + headR * 0.86, headY - headR * 0.72);
  g.lineTo(cx - headR * 0.86, headY - headR * 0.72);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  circle(g, cx, headY - headR - 12, 24, 0x3a2f26, THEME.outline, 5);

  // 白胡子：短一点、圆一点，别像一块围兜
  g.fillStyle(0xf7f2e6, 1);
  g.beginPath();
  g.moveTo(cx - 34, headY + 40);
  g.lineTo(cx + 34, headY + 40);
  g.lineTo(cx, headY + 104);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, THEME.outline, 1);
  g.strokePath();

  // 表情画在胡子之前的位置：尝到东西时，脸上看得出来
  face(g, cx, headY - 4, mood);

  if (mood === 'poison') {
    // 只是难受一下：脸发青 + 头上转圈的小星星，不出现倒下
    g.fillStyle(0x7fc48a, 0.34);
    g.fillCircle(cx, headY + 6, headR - 4);
    for (let i = 0; i < 3; i += 1) {
      const a = -Math.PI / 2 + i * 2.1;
      const sx = cx + Math.cos(a) * 96;
      const sy = headY - 92 + Math.sin(a) * 22;
      g.fillStyle(THEME.gold, 1);
      g.fillCircle(sx, sy, 11);
      g.lineStyle(4, THEME.goldDeep, 1);
      g.strokeCircle(sx, sy, 11);
    }
  }
}

/** 尝一口时嘴边的小光点（由 index.ts 触发，画在世界层上） */
export function drawTasteGlow(g: Phaser.GameObjects.Graphics, kind: string): void {
  const color = kind === 'poison' ? 0x8b5fbf : THEME.gold;
  g.fillStyle(color, 0.3);
  g.fillCircle(375, 330, 96);
}

// ---------- 世界 ----------

export function drawWorld(g: Phaser.GameObjects.Graphics, mood: Mood): void {
  const W = 750;
  const H = 1334;

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, W, 360);
  circle(g, 648, 246, 50, 0xfbe08a, THEME.goldDeep, 6);

  g.fillStyle(0x9fd0b8, 1);
  g.fillTriangle(20, 500, 220, 320, 430, 500);
  g.fillTriangle(330, 500, 530, 336, 740, 500);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(20, 500, 220, 320, 430, 500);
  g.strokeTriangle(330, 500, 530, 336, 740, 500);

  g.fillStyle(FIELD, 1);
  g.fillRect(0, 496, W, H - 496);

  // 两垄土：六株草就长在上面
  roundRect(g, 52, 556, 646, 152, 42, SOIL, shade(SOIL, 0.8), 5);
  roundRect(g, 52, 726, 646, 152, 42, SOIL, shade(SOIL, 0.8), 5);

  drawShennong(g, mood);
}

// ---------- 木牍与草药 ----------

function drawIcon(g: Phaser.GameObjects.Graphics, kind: string, x: number, y: number, s: number): void {
  if (kind === 'food') {
    // 麦穗
    g.lineStyle(7 * s, 0x8a6a2f, 1);
    g.lineBetween(x, y + 54 * s, x, y - 46 * s);
    g.fillStyle(THEME.gold, 1);
    for (let i = 0; i < 3; i += 1) {
      const gy = y - 8 * s + i * 22 * s;
      g.fillEllipse(x - 15 * s, gy, 26 * s, 17 * s);
      g.fillEllipse(x + 15 * s, gy, 26 * s, 17 * s);
    }
    g.fillEllipse(x, y - 56 * s, 24 * s, 34 * s);
    return;
  }

  if (kind === 'cure') {
    // 药碗 + 一片叶子
    g.fillStyle(0xfdf3dc, 1);
    g.fillRoundedRect(x - 44 * s, y - 6 * s, 88 * s, 52 * s, { tl: 0, tr: 0, bl: 30 * s, br: 30 * s });
    g.lineStyle(6 * s, THEME.outline, 1);
    g.strokeRoundedRect(x - 44 * s, y - 6 * s, 88 * s, 52 * s, { tl: 0, tr: 0, bl: 30 * s, br: 30 * s });
    g.fillStyle(THEME.teal, 1);
    g.fillEllipse(x, y - 26 * s, 52 * s, 34 * s);
    g.fillStyle(THEME.leaf, 1);
    g.fillEllipse(x, y - 56 * s, 40 * s, 26 * s);
    g.lineStyle(5 * s, THEME.outline, 1);
    g.lineBetween(x, y - 56 * s, x, y - 30 * s);
    return;
  }

  // 不能吃：禁止符
  g.lineStyle(9 * s, THEME.redDeep, 1);
  g.strokeCircle(x, y, 44 * s);
  g.lineBetween(x - 31 * s, y + 31 * s, x + 31 * s, y - 31 * s);
  g.fillStyle(0x8b7f74, 1);
  g.fillEllipse(x, y + 16 * s, 26 * s, 14 * s);
  g.fillRect(x - 7 * s, y - 2 * s, 14 * s, 20 * s);
  g.fillEllipse(x, y - 12 * s, 44 * s, 26 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeEllipse(x, y - 12 * s, 44 * s, 26 * s);
}

export function drawBoard(
  g: Phaser.GameObjects.Graphics,
  bin: SortBin,
  highlighted: boolean,
  filled: number,
): void {
  const { x, y, radius } = bin;
  if (highlighted) {
    g.fillStyle(THEME.gold, 0.24);
    g.fillCircle(x, y, radius + 36);
  }
  roundRect(g, x - radius * 0.93, y - radius * 0.92, radius * 1.86, radius * 1.84, 26, 0xf0dcb4, THEME.woodDeep, 6);
  roundRect(g, x - radius * 0.78, y - radius * 0.78, radius * 1.56, radius * 1.56, 20, 0xfdf3dc, shade(0xd9c08a, 1), 4);
  drawIcon(g, bin.kind, x, y - radius * 0.34, 0.5);
  if (filled > 0) {
    // 放进去的越多，木牍越亮
    g.fillStyle(THEME.gold, 0.1 + filled * 0.08);
    g.fillCircle(x, y - radius * 0.34, radius * 0.72);
  }
}

export function drawPlant(
  g: Phaser.GameObjects.Graphics,
  item: SortItem,
  state: SortItemState,
): void {
  g.fillStyle(THEME.outline, 0.14);
  g.fillEllipse(0, 46, 96, 26);

  const leaf = THEME.leaf;
  switch (item.kind) {
    case 'grain':
      g.lineStyle(7, 0x8a6a2f, 1);
      g.lineBetween(0, 44, 0, -44);
      g.fillStyle(THEME.gold, 1);
      for (let i = 0; i < 3; i += 1) {
        const gy = -6 + i * 20;
        g.fillEllipse(-14, gy, 26, 17);
        g.fillEllipse(14, gy, 26, 17);
      }
      g.fillEllipse(0, -54, 24, 34);
      break;
    case 'berry':
      // 一丛小灌木，三片叶子 + 三颗红果
      g.fillStyle(0x8a6a2f, 1);
      g.fillRect(-5, -6, 10, 48);
      g.fillStyle(leaf, 1);
      g.fillEllipse(-30, -26, 48, 30);
      g.fillEllipse(30, -26, 48, 30);
      g.fillEllipse(0, -44, 42, 30);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeEllipse(0, -44, 42, 30);
      g.fillStyle(THEME.red, 1);
      g.fillCircle(-24, 12, 15);
      g.fillCircle(22, 4, 15);
      g.fillCircle(2, 26, 15);
      break;
    case 'liquorice': {
      // 一根弯弯的甘草根，带着两片叶
      g.lineStyle(22, 0xc0955c, 1);
      g.beginPath();
      g.moveTo(-44, 20);
      g.lineTo(-12, 2);
      g.lineTo(16, 18);
      g.lineTo(44, -2);
      g.strokePath();
      g.lineStyle(7, THEME.outline, 1);
      g.beginPath();
      g.moveTo(-44, 20);
      g.lineTo(-12, 2);
      g.lineTo(16, 18);
      g.lineTo(44, -2);
      g.strokePath();
      g.fillStyle(leaf, 1);
      g.fillEllipse(-26, -30, 44, 28);
      g.fillEllipse(18, -36, 44, 28);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeEllipse(18, -36, 44, 28);
      break;
    }
    case 'ginger': {
      // 一块疙瘩状的姜，顶上一支嫩芽
      g.fillStyle(0xe0b46a, 1);
      g.fillRoundedRect(-40, -14, 56, 40, 20);
      g.fillRoundedRect(-6, -4, 46, 36, 18);
      g.fillRoundedRect(-24, -32, 40, 34, 17);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeRoundedRect(-40, -14, 56, 40, 20);
      g.strokeRoundedRect(-6, -4, 46, 36, 18);
      g.strokeRoundedRect(-24, -32, 40, 34, 17);
      g.fillStyle(leaf, 1);
      g.fillEllipse(-4, -50, 38, 24);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeEllipse(-4, -50, 38, 24);
      break;
    }
    case 'mushroom':
      g.fillStyle(0xf3e6cf, 1);
      g.fillRoundedRect(-15, -6, 30, 48, 12);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeRoundedRect(-15, -6, 30, 48, 12);
      g.fillStyle(THEME.redDeep, 1);
      g.fillEllipse(0, -14, 96, 56);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeEllipse(0, -14, 96, 56);
      g.fillStyle(THEME.card, 1);
      g.fillCircle(-24, -18, 8);
      g.fillCircle(18, -26, 7);
      break;
    default:
      // 不认识的蓝果子
      g.fillStyle(leaf, 1);
      g.fillEllipse(-24, -6, 52, 32);
      g.fillEllipse(24, -6, 52, 32);
      g.fillStyle(0x4f6fd0, 1);
      g.fillCircle(0, 4, 18);
      g.fillCircle(-26, 16, 15);
      g.fillCircle(26, 16, 15);
      g.lineStyle(6, THEME.outline, 1);
      g.strokeCircle(0, 4, 18);
      break;
  }

  if (!state.tasted) {
    questionBubble(g, 40, -56, 24);
    return;
  }
  // 尝过了：草上带着结论的小牌子（图案和木牍上的一模一样，不用认字）
  circle(g, 42, -52, 26, THEME.card, THEME.outline, 5);
  drawIcon(g, item.tastedKind ?? 'food', 42, -52, 0.3);
}

// ---------- 收尾 ----------

export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xfbe08a, 0.3);
  g.fillCircle(375, 720, 320);
  // 最早的药书：六片竹简，一片记一种草
  for (let i = 0; i < 6; i += 1) {
    const x = 375 - 216 + i * 74;
    roundRect(g, x, 604, 66, 300, 14, i % 2 === 0 ? 0xf0dcb4 : 0xe8d0a0, THEME.woodDeep, 5);
    drawIcon(g, i < 2 ? 'food' : i < 4 ? 'cure' : 'poison', x + 33, 700, 0.26);
  }
  g.fillStyle(THEME.redDeep, 1);
  g.fillRect(140, 646, 470, 12);
  g.fillRect(140, 866, 470, 12);
  for (let i = 0; i < 8; i += 1) {
    const x = 120 + i * 72;
    g.fillStyle(THEME.gold, 0.9);
    g.fillCircle(x, 960 - (i % 3) * 26, 9);
  }
}

// ---------- 分幕插图 ----------

function person(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  robe: number,
  sick: boolean,
): void {
  const headR = 32 * s;
  const headY = y - 176 * s;
  roundRect(g, x - 44 * s, headY + headR * 0.5, 88 * s, 132 * s, 30 * s, robe, THEME.outline, 6 * s);
  circle(g, x, headY, headR, SKIN, THEME.outline, 6 * s);
  g.fillStyle(THEME.outline, 1);
  if (sick) {
    g.lineStyle(5 * s, THEME.outline, 1);
    g.lineBetween(x - 20 * s, headY - 14 * s, x - 6 * s, headY - 2 * s);
    g.lineBetween(x - 6 * s, headY - 14 * s, x - 20 * s, headY - 2 * s);
    g.lineBetween(x + 6 * s, headY - 14 * s, x + 20 * s, headY - 2 * s);
    g.lineBetween(x + 20 * s, headY - 14 * s, x + 6 * s, headY - 2 * s);
    strokeArc(g, x, headY + 26 * s, 14 * s, Math.PI * 0.15, Math.PI * 0.85, 5 * s);
  } else {
    g.fillCircle(x - 13 * s, headY - 6 * s, 6 * s);
    g.fillCircle(x + 13 * s, headY - 6 * s, 6 * s);
    strokeArc(g, x, headY + 12 * s, 14 * s, Math.PI * 0.18, Math.PI * 0.82, 5 * s);
  }
}

export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(FIELD, 1);
  g.fillRect(x, y + h - 210, w, 210);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(x + w - 90, y + 90, 38);

  if (index === 0) {
    // 不知道吃什么：有人在田边捂着肚子，有人抱着采来的野果
    person(g, x + 170, y + h - 30, 1, THEME.teal, true);
    person(g, x + 420, y + h - 30, 1.05, THEME.red, false);
    g.fillStyle(THEME.leaf, 1);
    g.fillEllipse(x + 430, y + h - 300, 90, 60);
    g.fillStyle(THEME.red, 1);
    g.fillCircle(x + 400, y + h - 280, 14);
    g.fillCircle(x + 448, y + h - 292, 13);
    roundRect(g, x + 330, y + h - 300, 84, 66, 16, 0xdcb26a, THEME.woodDeep, 5);
    return;
  }

  // 尝一尝：山里，神农弯着腰尝一株草
  g.fillStyle(0x9fd0b8, 1);
  g.fillTriangle(x + 10, y + h - 210, x + 180, y + 90, x + 350, y + h - 210);
  g.fillTriangle(x + 300, y + h - 210, x + 500, y + 140, x + w - 10, y + h - 210);
  person(g, x + 380, y + h - 40, 1.1, ROBE, false);
  g.fillStyle(THEME.leaf, 1);
  g.fillEllipse(x + 300, y + h - 130, 76, 48);
  questionBubble(g, x + 268, y + h - 176, 24);
  roundRect(g, x + 120, y + h - 130, 96, 76, 18, 0xdcb26a, THEME.woodDeep, 5);
}
