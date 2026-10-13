import type Phaser from 'phaser';
import { THEME, circle, roundRect, shade } from '@chags/phaser-kit';

/**
 * 盘古：被天与地夹在中间的人。
 * 他的高度由上下边界决定 —— 天撑得越高，他在画面里被拉得越长。
 */
export function drawPangu(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  top: number,
  bottom: number,
): void {
  const height = Math.max(40, bottom - top);

  // 天地还没分开：他只能蜷在中间
  if (height < 130) {
    const cy = (top + bottom) / 2;
    roundRect(g, cx - 30, cy - 4, 60, Math.max(14, height * 0.5), 18, THEME.red, THEME.outline, 5);
    circle(g, cx, cy - 16, Math.min(20, height * 0.32), 0xf6d3ae, THEME.outline, 5);
    return;
  }

  const headR = Math.min(42, Math.max(16, height * 0.07));
  const headY = top + headR + 12;
  const feetY = bottom - 12;
  const bodyTop = headY + headR * 0.8;
  const bodyBottom = Math.max(bodyTop + 10, feetY - 46);
  const bodyW = Math.min(104, Math.max(30, height * 0.15));

  // 腿
  roundRect(g, cx - bodyW * 0.34 - 15, feetY - 48, 30, 52, 15, shade(THEME.red, 0.8), THEME.outline, 5);
  roundRect(g, cx + bodyW * 0.34 - 15, feetY - 48, 30, 52, 15, shade(THEME.red, 0.8), THEME.outline, 5);

  // 双臂向上撑住天
  g.lineStyle(Math.max(10, bodyW * 0.3), THEME.red, 1);
  g.beginPath();
  g.moveTo(cx - bodyW * 0.28, bodyTop + 26);
  g.lineTo(cx - 104, top + 24);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + bodyW * 0.28, bodyTop + 26);
  g.lineTo(cx + 104, top + 24);
  g.strokePath();

  // 身体
  roundRect(g, cx - bodyW / 2, bodyTop, bodyW, bodyBottom - bodyTop, bodyW / 2.8, THEME.red, THEME.outline, 6);

  // 手
  const handR = Math.max(11, bodyW * 0.22);
  circle(g, cx - 106, top + 22, handR, 0xf6d3ae, THEME.outline, 5);
  circle(g, cx + 106, top + 22, handR, 0xf6d3ae, THEME.outline, 5);

  // 头
  circle(g, cx, headY, headR, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  for (let i = -2; i <= 2; i += 1) {
    g.fillCircle(cx + i * headR * 0.36, headY - headR * 0.8, headR * 0.28);
  }
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(cx - headR * 0.34, headY - headR * 0.06, Math.max(2, headR * 0.13));
  g.fillCircle(cx + headR * 0.34, headY - headR * 0.06, Math.max(2, headR * 0.13));
}

/** 蛋壳底色：画在混沌粒子之下（粒子要能透过壳看见） */
export function drawEggBase(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  g.fillStyle(0x241d3a, 1);
  g.fillEllipse(cx, cy, rx * 2, ry * 2);
  g.lineStyle(9, 0x6f5f9c, 1);
  g.strokeEllipse(cx, cy, rx * 2, ry * 2);
}

/** 壳上的裂缝：cracks 越多，裂得越开 */
export function drawEggCracks(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cracks: number,
): void {
  g.lineStyle(7, 0xffe9a8, 0.95);
  for (let i = 0; i < cracks; i += 1) {
    const base = -0.7 + i * 0.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(base) * rx * 0.95, cy + Math.sin(base) * ry * 0.95);
    for (let step = 1; step <= 4; step += 1) {
      const t = step / 4;
      const wobble = step % 2 === 0 ? 1 : -1;
      g.lineTo(
        cx + Math.cos(base) * rx * 0.95 * (1 - t * 0.55) + wobble * 16,
        cy + Math.sin(base) * ry * 0.95 * (1 - t * 0.55) + wobble * 10,
      );
    }
    g.strokePath();
  }
}

/** 世界里的六个位置：空着的时候是"轮廓"，归位后亮起来 */
export function drawPiece(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
  filled: boolean,
): void {
  const dim = (fillAlpha: number, lineAlpha: number): void => {
    g.fillStyle(THEME.outline, fillAlpha);
    g.lineStyle(6, THEME.outline, lineAlpha);
  };

  switch (kind) {
    case 'sun': {
      if (filled) {
        g.fillStyle(THEME.gold, 1);
        g.lineStyle(6, THEME.outline, 1);
      } else {
        dim(0.14, 0.4);
      }
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8;
        g.lineBetween(
          x + Math.cos(a) * 46, y + Math.sin(a) * 46,
          x + Math.cos(a) * 64, y + Math.sin(a) * 64,
        );
      }
      g.fillStyle(filled ? THEME.gold : THEME.outline, filled ? 1 : 0.14);
      g.fillCircle(x, y, 44);
      g.lineStyle(6, filled ? THEME.outline : THEME.outline, filled ? 1 : 0.4);
      g.strokeCircle(x, y, 44);
      break;
    }
    case 'moon': {
      g.fillStyle(filled ? THEME.card : THEME.outline, filled ? 1 : 0.14);
      g.fillCircle(x, y, 44);
      g.lineStyle(6, THEME.outline, filled ? 1 : 0.4);
      g.strokeCircle(x, y, 44);
      // 用天空色"咬"出一弯月牙
      g.fillStyle(THEME.sky, 1);
      g.fillCircle(x + 22, y - 12, 36);
      break;
    }
    case 'stars': {
      for (const [dx, dy, r] of [[-70, 10, 12], [-24, -26, 9], [22, 6, 13], [66, -20, 8], [10, 40, 7]] as const) {
        g.fillStyle(filled ? THEME.gold : THEME.outline, filled ? 1 : 0.2);
        g.fillCircle(x + dx, y + dy, r);
      }
      break;
    }
    case 'wind': {
      g.lineStyle(8, filled ? THEME.card : THEME.outline, filled ? 0.95 : 0.35);
      for (const dy of [-28, 0, 28]) {
        g.beginPath();
        g.moveTo(x - 66, y + dy);
        g.lineTo(x + 40, y + dy);
        g.strokePath();
        g.beginPath();
        g.arc(x + 40, y + dy - 12, 14, Math.PI * 0.5, Math.PI * 1.5, false);
        g.strokePath();
      }
      break;
    }
    case 'river': {
      g.fillStyle(filled ? THEME.water : THEME.outline, filled ? 1 : 0.16);
      g.beginPath();
      g.moveTo(x - 110, y - 14);
      for (let i = 0; i <= 8; i += 1) {
        g.lineTo(x - 110 + (220 * i) / 8, y - 14 + Math.sin(i * 1.1) * 12);
      }
      for (let i = 8; i >= 0; i -= 1) {
        g.lineTo(x - 110 + (220 * i) / 8, y + 26 + Math.sin(i * 1.1) * 12);
      }
      g.closePath();
      g.fillPath();
      g.lineStyle(6, THEME.outline, filled ? 0.8 : 0.35);
      g.strokePath();
      break;
    }
    case 'grass': {
      g.lineStyle(9, filled ? THEME.leaf : THEME.outline, filled ? 1 : 0.35);
      for (const dx of [-64, -30, 4, 38, 70]) {
        g.beginPath();
        g.moveTo(x + dx, y + 42);
        g.lineTo(x + dx + 8, y - 34);
        g.strokePath();
        g.beginPath();
        g.moveTo(x + dx + 8, y - 8);
        g.lineTo(x + dx + 32, y - 30);
        g.strokePath();
      }
      break;
    }
    default:
      break;
  }
}

/** 光球：外发光 + 一团提示"这是身体的哪一部分"的小图标 */
export function drawOrb(g: Phaser.GameObjects.Graphics, kind: string): void {
  g.fillStyle(THEME.gold, 0.3);
  g.fillCircle(0, 0, 62);
  g.fillStyle(THEME.card, 1);
  g.fillCircle(0, 0, 46);
  g.lineStyle(6, THEME.gold, 1);
  g.strokeCircle(0, 0, 46);

  g.lineStyle(6, THEME.red, 1);
  g.fillStyle(THEME.red, 1);
  switch (kind) {
    case 'eye':
      g.strokeEllipse(0, 0, 54, 32);
      g.fillCircle(0, 0, 10);
      break;
    case 'hair':
      for (const dx of [-16, 0, 16]) {
        g.beginPath();
        g.moveTo(dx, -22);
        g.lineTo(dx, 22);
        g.strokePath();
      }
      break;
    case 'breath':
      g.beginPath();
      g.arc(0, 2, 22, Math.PI * 0.15, Math.PI * 1.55, false);
      g.strokePath();
      break;
    case 'blood':
      g.fillTriangle(0, -24, -17, 10, 17, 10);
      g.fillCircle(0, 12, 16);
      break;
    case 'skin':
      for (const dx of [-15, 0, 15]) {
        g.beginPath();
        g.moveTo(dx, 22);
        g.lineTo(dx + 4, -20);
        g.strokePath();
      }
      break;
    default:
      break;
  }
}

/** 分幕插图：一屏一个画面 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;

  if (index === 0) {
    // 还没有天地：一片深色的虚空，只有微光在打转
    g.fillStyle(0x241d3a, 1);
    g.fillRoundedRect(x, y, w, h, 34);
    g.lineStyle(7, 0x6f5f9c, 1);
    g.strokeRoundedRect(x, y, w, h, 34);
    for (let i = 0; i < 16; i += 1) {
      const a = i * 1.7;
      const r = 40 + i * 14;
      g.fillStyle(0xffe9a8, 0.25 + (i % 3) * 0.12);
      g.fillCircle(x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r * 0.72, 6 + (i % 3) * 4);
    }
    return;
  }

  // 一个大鸡蛋，盘古睡在里面
  g.fillStyle(0x241d3a, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(0x4a3f6b, 1);
  g.fillEllipse(x + w / 2, y + h / 2, 300, 380);
  g.lineStyle(9, 0x8b7bc0, 1);
  g.strokeEllipse(x + w / 2, y + h / 2, 300, 380);
  drawPangu(g, x + w / 2, y + h / 2 - 60, y + h / 2 + 70);
}
