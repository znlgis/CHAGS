import type Phaser from 'phaser';
import { THEME } from '@chags/phaser-kit';

const GREY = 0x9a9791;
const GREY_DARK = 0x7d7a75;

/** 阶段 0 用几何图形画大象，等美术到位后只需换掉这个函数 */
export function drawElephant(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s = 1,
): void {
  g.fillStyle(GREY_DARK, 1);
  for (const dx of [-62, -20, 26, 66]) {
    g.fillRoundedRect(x + dx * s - 15 * s, y + 26 * s, 30 * s, 74 * s, 10 * s);
  }
  g.fillStyle(GREY, 1);
  g.fillEllipse(x, y, 200 * s, 140 * s);
  g.fillStyle(GREY_DARK, 1);
  g.fillEllipse(x + 58 * s, y - 24 * s, 76 * s, 88 * s);
  g.fillStyle(GREY, 1);
  g.fillCircle(x + 88 * s, y - 14 * s, 54 * s);
  g.lineStyle(22 * s, GREY, 1);
  g.beginPath();
  g.moveTo(x + 128 * s, y + 4 * s);
  g.lineTo(x + 152 * s, y + 62 * s);
  g.lineTo(x + 114 * s, y + 92 * s);
  g.strokePath();
  g.fillStyle(THEME.ink, 1);
  g.fillCircle(x + 108 * s, y - 26 * s, 7 * s);
}

function drawBoat(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.fillStyle(THEME.water, 0.85);
  g.fillRect(cx - 230, cy, 460, 90);
  g.fillStyle(THEME.wood, 1);
  g.fillRoundedRect(cx - 150, cy - 70, 300, 90, { tl: 14, tr: 14, bl: 40, br: 40 });
  g.lineStyle(6, THEME.red, 1);
  g.lineBetween(cx - 168, cy - 24, cx + 168, cy - 24);
  g.fillStyle(THEME.stone, 1);
  for (let i = 0; i < 5; i += 1) {
    g.fillCircle(cx - 100 + i * 48, cy - 92, 20);
  }
}

function drawOfficial(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(THEME.teal, 1);
  g.fillRoundedRect(x - 34, y + 30, 68, 80, 18);
  g.fillStyle(0xe8c9a0, 1);
  g.fillCircle(x, y, 30);
  g.fillStyle(THEME.ink, 1);
  g.fillRect(x - 36, y - 34, 72, 16);
  g.fillCircle(x - 12, y - 4, 4);
  g.fillCircle(x + 12, y - 4, 4);
}

/** 随分幕推进的插图：大象上船 → 换成石头 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const left = rect.x + 20;
  const top = rect.y + 20;
  const width = rect.w - 40;
  const height = rect.h - 40;
  const groundY = top + height - 96;

  g.fillStyle(0xdcecf5, 1);
  g.fillRoundedRect(left, top, width, height, 28);
  g.fillStyle(0xf0e4c8, 1);
  g.fillRect(left, groundY, width, top + height - groundY);
  g.fillStyle(0xf2c14e, 1);
  g.fillCircle(left + width - 92, top + 84, 44);

  const cx = left + width / 2;

  if (index === 0) {
    drawElephant(g, cx - 40, groundY - 90, 1.15);
  } else if (index === 1) {
    drawElephant(g, cx - 140, groundY - 80, 0.9);
    // 一把“不够大”的秤
    g.lineStyle(10, THEME.woodDeep, 1);
    g.lineBetween(cx + 60, groundY - 170, cx + 60, groundY);
    g.lineBetween(cx - 10, groundY - 170, cx + 130, groundY - 170);
    g.fillStyle(THEME.stoneDeep, 1);
    g.fillCircle(cx - 10, groundY - 140, 26);
    g.fillCircle(cx + 130, groundY - 140, 26);
    g.lineStyle(14, THEME.red, 1);
    g.lineBetween(cx + 30, groundY - 210, cx + 100, groundY - 140);
    g.lineBetween(cx + 100, groundY - 210, cx + 30, groundY - 140);
  } else if (index === 2) {
    drawOfficial(g, cx - 170, groundY - 130);
    drawOfficial(g, cx - 40, groundY - 130);
    drawOfficial(g, cx + 90, groundY - 130);
    g.fillStyle(THEME.red, 1);
    g.fillCircle(cx + 210, groundY - 150, 52);
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx + 190, groundY - 196, 40, 66);
    g.fillCircle(cx + 210, groundY - 116, 12);
  } else {
    drawBoat(g, cx, groundY - 40);
    drawElephant(g, cx - 60, groundY - 150, 0.6);
  }
}
