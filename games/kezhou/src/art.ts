import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { MarkStageState } from '@chags/templates';
import {
  BANK_TOP, BOAT_X, BOAT_Y, ROCK_X, ROCK_Y, SKY_TOP, SWORD_X, SWORD_Y, TREE_X, WATER_TOP,
} from './layout';


/** 水底的剑：一点微光，位置永远不会变 */
export function drawSword(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  glow: boolean,
): void {
  if (glow) {
    g.fillStyle(THEME.gold, 0.35);
    g.fillCircle(x, y, 120);
  } else {
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(x, y, 74);
  }
  // 剑身朝下、剑柄朝上，插在河底
  roundRect(g, x - 13, y - 110, 26, 168, 10, 0xdfe6ee, THEME.outline, 5);
  roundRect(g, x - 56, y - 124, 112, 20, 10, THEME.gold, THEME.outline, 5);
  roundRect(g, x - 11, y - 168, 22, 46, 10, THEME.wood, THEME.outline, 5);
  circle(g, x, y - 176, 13, THEME.red, THEME.outline, 5);
  // 水草
  g.lineStyle(6, 0x4f9a72, 0.85);
  for (const [dx, hh] of [[-58, 46], [-38, 66], [46, 52]] as const) {
    g.beginPath();
    g.moveTo(x + dx, y + 40);
    g.lineTo(x + dx + 12, y + 40 - hh);
    g.strokePath();
  }
}

/** 乌篷船：船帮上刻了记号，就多一道刀痕 */
export function drawBoat(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  carved: boolean,
): void {
  groundShadow(g, x, y + 78, 300, 40, 0.16);
  // 船身
  roundRect(g, x - 150, y - 46, 300, 124, { tl: 30, tr: 30, bl: 76, br: 76 }, THEME.wood, THEME.outline, 7);
  roundRect(g, x - 150, y - 46, 300, 34, { tl: 28, tr: 28, bl: 0, br: 0 }, shade(THEME.wood, 1.18), THEME.outline, 5);
  // 乌篷
  roundRect(g, x - 66, y - 130, 132, 90, { tl: 66, tr: 66, bl: 0, br: 0 }, shade(THEME.woodDeep, 0.9), THEME.outline, 6);
  // 桅杆与帆
  g.lineStyle(7, THEME.woodDeep, 1);
  g.lineBetween(x + 78, y - 46, x + 78, y - 220);
  g.fillStyle(THEME.paper, 1);
  g.fillTriangle(x + 78, y - 212, x + 78, y - 60, x + 150, y - 92);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x + 78, y - 212, x + 78, y - 60, x + 150, y - 92);
  // 船帮上的刻痕
  if (carved) {
    g.lineStyle(8, THEME.outline, 1);
    g.lineBetween(x - 26, y + 6, x + 26, y + 6);
    g.lineBetween(x - 26, y + 24, x + 26, y + 24);
    g.fillStyle(THEME.red, 1);
    g.fillCircle(x + 40, y + 15, 9);
  }
}

/** 岸边的小树：记号刻在树干上 */
export function drawTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  carved: boolean,
): void {
  groundShadow(g, x, 1256, 170, 40, 0.18);
  roundRect(g, x - 22, 1080, 44, 176, 18, THEME.woodDeep, THEME.outline, 6);
  g.fillStyle(THEME.leaf, 1);
  for (const [dx, dy, r] of [[0, 1030, 74], [-62, 1074, 52], [62, 1074, 52]] as const) {
    g.fillCircle(x + dx, dy, r);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeCircle(x + dx, dy, r);
  }
  if (carved) {
    g.lineStyle(8, THEME.outline, 1);
    g.lineBetween(x - 20, 1152, x + 20, 1152);
    g.fillStyle(THEME.red, 1);
    g.fillCircle(x + 30, 1152, 9);
  }
}

/** 下游岸边的大石头 */
export function drawRock(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  carved: boolean,
): void {
  groundShadow(g, x, y + 46, 200, 42, 0.18);
  g.fillStyle(THEME.stone, 1);
  g.fillEllipse(x, y, 176, 132);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y, 176, 132);
  g.fillStyle(shade(THEME.stone, 1.12), 1);
  g.fillEllipse(x - 26, y - 24, 80, 52);
  if (carved) {
    g.lineStyle(8, THEME.outline, 1);
    g.lineBetween(x + 20, y - 6, x + 56, y - 12);
    g.fillStyle(THEME.red, 1);
    g.fillCircle(x + 66, y - 14, 9);
  }
}

/** 有人下水了：水面一圈涟漪 + 一串气泡 */
function drawDive(
  g: Phaser.GameObjects.Graphics,
  x: number,
  result: 'found' | 'miss' | null,
): void {
  g.lineStyle(6, 0xffffff, 0.75);
  g.strokeEllipse(x, WATER_TOP + 16, 150, 42);
  g.strokeEllipse(x, WATER_TOP + 16, 96, 26);
  g.fillStyle(0xffffff, 0.5);
  for (const [dy, r] of [[150, 10], [230, 8], [300, 12], [360, 7]] as const) {
    g.fillCircle(x + (dy % 60) - 30, WATER_TOP + dy, r);
  }
  if (result === 'found') {
    g.fillStyle(THEME.gold, 0.3);
    g.fillCircle(x, SWORD_Y - 40, 150);
  }
}

/** 整屏世界。船的位置 = 会漂的那个面的世界坐标 */
export function drawWorld(g: Phaser.GameObjects.Graphics, state: MarkStageState): void {
  const W = DESIGN.width;
  const H = DESIGN.height;

  // 天与远山
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, WATER_TOP - SKY_TOP + 30);
  g.fillStyle(shade(THEME.skyDeep, 1.02), 1);
  g.fillEllipse(170, WATER_TOP + 6, 470, 210);
  g.fillEllipse(580, WATER_TOP + 18, 540, 176);

  // 江水
  wavyBand(g, 0, WATER_TOP, W, BANK_TOP - WATER_TOP + 40, THEME.water, 1, 10, 3);
  g.fillStyle(THEME.waterDeep, 0.3);
  g.fillRect(0, 860, W, BANK_TOP - 860 + 40);
  g.lineStyle(5, 0xffffff, 0.32);
  for (const wy of [640, 750, 860, 960] as const) {
    g.beginPath();
    g.moveTo(0, wy);
    for (let i = 0; i <= 16; i += 1) {
      g.lineTo((W * i) / 16, wy + Math.sin((i / 16) * Math.PI * 3) * 9);
    }
    g.strokePath();
  }

  // 水底的剑：一直在这儿，位置不动
  drawSword(g, SWORD_X, SWORD_Y, state.result === 'found');

  // 近岸
  roundRect(
    g, -40, BANK_TOP, W + 80, H - BANK_TOP + 40,
    { tl: 70, tr: 70, bl: 0, br: 0 }, THEME.sand, THEME.outline, 7,
  );
  drawTree(g, TREE_X, state.marks.includes('tree'));
  drawRock(g, ROCK_X, ROCK_Y, state.marks.includes('rock'));

  // 船（刻在船帮上的记号跟着它一起走）
  drawBoat(g, BOAT_X + state.driftPx, BOAT_Y, state.marks.includes('boat'));

  if (state.divingAt !== null) drawDive(g, state.divingAt, state.result);
}

/** 收尾：剑捞上来了，船上那道刻痕还在 */
export function drawFinale(g: Phaser.GameObjects.Graphics, state: MarkStageState): void {
  g.fillStyle(THEME.gold, 0.22);
  g.fillCircle(BOAT_X + state.driftPx, BOAT_Y, 260);
  g.lineStyle(9, THEME.gold, 0.8);
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    g.lineBetween(
      SWORD_X + Math.cos(angle) * 120,
      SWORD_Y + Math.sin(angle) * 120,
      SWORD_X + Math.cos(angle) * 190,
      SWORD_Y + Math.sin(angle) * 190,
    );
  }
}
/** 分幕插图：① 剑掉进江里 ② 他在船帮上刻记号 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  wavyBand(g, x, y + h * 0.52, w, h * 0.48, THEME.water, 1, 8, 2.5);
  g.fillStyle(THEME.sand, 1);
  g.fillRoundedRect(x - 20, y + h * 0.86, w + 40, h * 0.2, 26);

  if (index === 0) {
    // 船到江心，剑正往下掉
    drawBoat(g, x + w * 0.5, y + h * 0.46, false);
    drawSword(g, x + w * 0.5 + 46, y + h * 0.72, false);
    g.lineStyle(5, 0xffffff, 0.7);
    g.strokeCircle(x + w * 0.5 + 46, y + h * 0.58, 28);
  } else {
    // 他蹲在船帮边刻记号
    drawBoat(g, x + w * 0.52, y + h * 0.46, true);
    circle(g, x + w * 0.3, y + h * 0.3, 26, 0xf6d3ae, THEME.outline, 6);
    roundRect(g, x + w * 0.3 - 30, y + h * 0.34, 60, 84, 22, THEME.red, THEME.outline, 6);
    g.lineStyle(7, THEME.outline, 1);
    g.lineBetween(x + w * 0.52 - 16, y + h * 0.48, x + w * 0.52 + 16, y + h * 0.48);
  }
}