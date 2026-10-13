import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect } from '@chags/phaser-kit';

/**
 * 圆润卡通大象：全部用几何图形画，没有图片资源。
 * 美术到位后只要换掉这个函数，其余代码不用动。
 */
export function drawElephant(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  s = 1,
): void {
  const body = THEME.elephant;
  const dark = THEME.elephantDeep;
  const stroke = 6 * s;

  // 四条粗腿
  for (const dx of [-62, -22, 26, 64]) {
    roundRect(g, cx + (dx - 17) * s, cy + 30 * s, 34 * s, 74 * s, 15 * s, dark, THEME.outline, stroke);
  }
  // 身体
  g.fillStyle(body, 1);
  g.fillEllipse(cx, cy, 210 * s, 150 * s);
  g.lineStyle(stroke, THEME.outline, 1);
  g.strokeEllipse(cx, cy, 210 * s, 150 * s);
  // 尾巴
  g.lineStyle(9 * s, THEME.outline, 1);
  g.lineBetween(cx - 100 * s, cy - 10 * s, cx - 124 * s, cy - 44 * s);
  // 头
  circle(g, cx + 92 * s, cy - 12 * s, 58 * s, body, THEME.outline, stroke);
  // 耳朵
  circle(g, cx + 58 * s, cy - 30 * s, 44 * s, dark, THEME.outline, stroke);
  // 鼻子：一条上粗下细的路径
  g.fillStyle(body, 1);
  g.beginPath();
  g.moveTo(cx + 106 * s, cy - 4 * s);
  g.lineTo(cx + 148 * s, cy + 44 * s);
  g.lineTo(cx + 152 * s, cy + 96 * s);
  g.lineTo(cx + 128 * s, cy + 106 * s);
  g.lineTo(cx + 112 * s, cy + 88 * s);
  g.lineTo(cx + 124 * s, cy + 44 * s);
  g.lineTo(cx + 92 * s, cy + 6 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(stroke, THEME.outline, 1);
  g.strokePath();
  // 眼睛与腮红
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(cx + 116 * s, cy - 30 * s, 8 * s);
  g.fillStyle(0xf2a09a, 0.75);
  g.fillCircle(cx + 66 * s, cy + 6 * s, 17 * s);
  // 象牙
  g.fillStyle(0xfffaf0, 1);
  g.fillTriangle(
    cx + 130 * s, cy + 18 * s,
    cx + 156 * s, cy + 52 * s,
    cx + 122 * s, cy + 48 * s,
  );
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(
    cx + 130 * s, cy + 18 * s,
    cx + 156 * s, cy + 52 * s,
    cx + 122 * s, cy + 48 * s,
  );
}

function drawPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  robe: number,
  s = 1,
): void {
  roundRect(g, x - 30 * s, y + 6 * s, 60 * s, 74 * s, 22 * s, robe, THEME.outline, 5 * s);
  circle(g, x, y - 26 * s, 28 * s, 0xf6d3ae, THEME.outline, 5 * s);
  roundRect(g, x - 32 * s, y - 54 * s, 64 * s, 16 * s, 8 * s, THEME.inkSoft, THEME.outline, 4 * s);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 9 * s, y - 26 * s, 4 * s);
  g.fillCircle(x + 9 * s, y - 26 * s, 4 * s);
}

/** 分幕插图：一屏一个画面，尽量不说教 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const left = rect.x;
  const top = rect.y;
  const width = rect.w;
  const height = rect.h;
  const groundY = top + height - 110;

  // 天空 + 地面
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(left, top, width, height, 34);
  g.fillStyle(THEME.sand, 1);
  g.fillRect(left, groundY, width, top + height - groundY);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(left + width - 96, top + 96, 46);

  if (index === 0) {
    // 一头大象，两个看呆的人
    groundShadow(g, left + 300, groundY + 6, 250, 34, 0.16);
    drawElephant(g, left + 300, groundY - 90, 1.15);
    drawPerson(g, left + 90, groundY - 40, THEME.red, 1);
    drawPerson(g, left + 170, groundY - 34, THEME.teal, 0.85);
  } else {
    // 大象 + 一个大问号 + 被压垮的秤
    groundShadow(g, left + 240, groundY + 6, 230, 32, 0.16);
    drawElephant(g, left + 240, groundY - 90, 1.0);
    // 问号
    g.lineStyle(20, THEME.red, 1);
    g.beginPath();
    g.arc(left + width - 150, groundY - 230, 52, Math.PI * 1.15, Math.PI * 0.4, false);
    g.strokePath();
    g.fillStyle(THEME.red, 1);
    g.fillCircle(left + width - 150, groundY - 140, 16);
    // 压垮的秤
    g.lineStyle(9, THEME.woodDeep, 1);
    g.lineBetween(left + width - 90, groundY, left + width - 90, groundY - 90);
    g.lineStyle(14, THEME.red, 1);
    g.lineBetween(left + width - 130, groundY - 130, left + width - 50, groundY - 60);
    g.lineBetween(left + width - 50, groundY - 130, left + width - 130, groundY - 60);
  }
}
