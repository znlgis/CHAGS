import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { readProgressBar, readTicks } from '@chags/templates';
import type { ReadTell, ReadLevel } from '@chags/templates/schemas';
import type { ReadStageState } from '@chags/templates';

/**
 * 第 10 计的画面：一场宴席，一位说话的人。
 *
 * **画面里不出现刀** —— 孩子看到的只有一只手、一只袖子、一双眼睛。
 * 这一关教的是"识破"：好听的话底下，动作会露破绽；看懂动作就够了，
 * 不必、也不该学他那一套（结语落在"看动作"，不落在"学他"）。
 *
 * 人画在原点 (0, 0) 的"胸口"上，关卡脚本里的 speaker 坐标就是它的位置：
 * 头往上、肩往两边，桌子在下面。
 */

/** 人身上几个固定的地方（破绽的坐标就在这些地方附近） */
export const FIGURE = {
  /** 头的圆心相对胸口的位置 */
  head: { x: 0, y: -58 },
  headR: 92,
  /** 桌面相对胸口的位置 */
  tableY: 246,
  /** 两只手搭在桌上的位置：袖口在 x = ±208，手就在那儿往下一点 */
  cuffX: 208,
  cuffY: 96,
} as const;

/** 说话的人：宽袍、两只搭在桌上的手、一张笑脸 */
function drawHost(g: Phaser.GameObjects.Graphics, level: ReadLevel): void {
  const { x, y } = level.speaker;
  const head = { x: x + FIGURE.head.x, y: y + FIGURE.head.y };
  const tableY = y + FIGURE.tableY;

  // 坐席：一张矮几，上面有杯子和两碟点心（宴席，不是战场）
  groundShadow(g, x, tableY + 30, 520, 60, 0.14);
  roundRect(g, x - 250, tableY, 500, 96, 26, THEME.wood, THEME.outline, 7);
  roundRect(g, x - 234, tableY + 12, 468, 20, 10, shade(THEME.wood, 1.12), null, 0);
  for (const [dx, dy, color] of [
    [-150, -26, THEME.gold],
    [-86, -20, THEME.goldDeep],
    [58, -24, THEME.gold],
    [118, -18, THEME.goldDeep],
  ] as const) {
    circle(g, x + dx, tableY + dy, 22, color, THEME.outline, 5);
  }
  roundRect(g, x + 196, tableY - 54, 34, 54, 10, THEME.card, THEME.outline, 5);

  // 宽袍：肩与身子
  roundRect(g, x - 236, y + 40, 472, 250, { tl: 120, tr: 120, bl: 40, br: 40 },
    shade(THEME.teal, 0.92), THEME.outline, 7);
  // 领口
  g.fillStyle(THEME.card, 1);
  g.fillTriangle(x - 74, y + 44, x + 74, y + 44, x, y + 148);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 74, y + 44, x + 74, y + 44, x, y + 148);

  // 两只袖子垂在身侧，手搭在桌上（"袖口"的破绽就落在这一带）
  for (const side of [-1, 1] as const) {
    const cuff = x + side * FIGURE.cuffX;
    roundRect(g, cuff - 62, y + FIGURE.cuffY, 124, 190, 46, shade(THEME.teal, 0.82), THEME.outline, 6);
    // 手背
    circle(g, cuff, tableY - 44, 40, 0xf6d3ae, THEME.outline, 5);
    g.fillStyle(0xf6d3ae, 1);
    g.fillEllipse(cuff + side * 6, tableY - 30, 74, 46);
  }

  // 头、发冠、眉眼
  circle(g, head.x, head.y, FIGURE.headR, 0xf6d3ae, THEME.outline, 7);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(head.x, head.y - 56, 178, 86);
  roundRect(g, head.x - 34, head.y - 122, 68, 40, 14, THEME.inkSoft, THEME.outline, 5);
  // 眼睛（"眼神"的破绽就在这两点附近）
  for (const side of [-1, 1] as const) {
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(head.x + side * 34, head.y - 8, 26, 22);
  }
  // 一张一直在笑的脸
  g.lineStyle(7, THEME.outline, 0.9);
  g.beginPath();
  g.moveTo(head.x - 32, head.y + 40);
  g.lineTo(head.x - 16, head.y + 52);
  g.lineTo(head.x + 16, head.y + 52);
  g.lineTo(head.x + 32, head.y + 40);
  g.strokePath();
}

/** 宴席这一间的底：帷幕、席子、一盏灯 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: ReadLevel): void {
  // 房间：暖色帷幕
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillRect(0, 150, 750, 1334 - 150);
  for (const [x, w, color] of [
    [-40, 200, shade(THEME.red, 0.92)],
    [560, 240, shade(THEME.red, 0.86)],
  ] as const) {
    roundRect(g, x, 150, w, 1184, 0, color, null, 0);
  }
  g.lineStyle(8, shade(THEME.redDeep, 0.9), 1);
  for (const x of [160, 560] as const) g.lineBetween(x, 150, x, 1334);

  // 地上的席子
  roundRect(g, 40, 1080, 670, 220, 32, shade(THEME.sand, 0.9), THEME.outline, 6);
  wavyBand(g, 40, 1096, 670, 40, shade(THEME.sand, 0.84), 0.9, 7, 3, 24);

  // 边上的一盏灯（宴席上的光，不是兵器的光）
  const lampX = 96;
  const lampY = 470;
  g.lineStyle(10, THEME.woodDeep, 1);
  g.lineBetween(lampX, lampY + 120, lampX, lampY + 330);
  roundRect(g, lampX - 70, lampY + 300, 140, 40, 18, THEME.wood, THEME.outline, 6);
  circle(g, lampX, lampY + 60, 60, THEME.gold, THEME.outline, 7);
  g.fillStyle(THEME.card, 0.5);
  g.fillCircle(lampX - 16, lampY + 40, 22);

  drawHost(g, level);
}

/** 一处破绽自己的样子：眼睛 / 袖口 / 手指（三样都不一样，一眼分得开） */
function drawTellArt(
  g: Phaser.GameObjects.Graphics,
  tell: ReadTell,
  live: boolean,
  fade = 1,
): void {
  const { x, y } = tell;
  const alpha = (live ? 1 : 0.35) * fade;
  if (tell.kind === 'eye') {
    // 眼神：从眼睛上飘出去的一缕
    g.lineStyle(9, THEME.inkSoft, 0.85 * alpha);
    g.beginPath();
    g.moveTo(x - 34, y + 6);
    g.lineTo(x - 6, y - 10);
    g.lineTo(x + 24, y + 4);
    g.strokePath();
    g.fillStyle(THEME.inkSoft, 0.85 * alpha);
    g.fillTriangle(x + 24, y + 4, x + 8, y - 4, x + 16, y + 20);
    circle(g, x + 52, y + 16, 9, THEME.inkSoft, null, 0, 0.7 * alpha);
    circle(g, x + 78, y + 30, 6, THEME.inkSoft, null, 0, 0.5 * alpha);
    return;
  }
  if (tell.kind === 'sleeve') {
    // 袖口：一只手在袖子底下收紧了一下
    roundRect(g, x - 46, y - 24, 92, 62, 24, shade(THEME.teal, 0.78), THEME.outline, 5, alpha);
    g.lineStyle(7, THEME.outline, 0.8 * alpha);
    g.lineBetween(x - 30, y + 30, x + 30, y + 30);
    g.lineStyle(8, 0xf6d3ae, alpha);
    g.lineBetween(x - 18, y + 26, x + 20, y + 8);
  }
  // 手指：指尖在桌上轻轻敲了一下
  circle(g, x, y, 26, 0xf6d3ae, THEME.outline, 5, alpha);
  g.lineStyle(7, THEME.outline, 0.8 * alpha);
  g.lineBetween(x - 8, y + 30, x - 14, y + 64);
  g.lineBetween(x + 8, y + 30, x + 16, y + 62);
  g.fillStyle(THEME.outline, 0.5 * alpha);
  g.fillEllipse(x, y + 74, 62, 16);
}

/**
 * 此刻露出来的破绽。
 * 只画"窗口里看得见"的那一处 —— 孩子要学会的是等它露出来，而不是到处乱点。
 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: ReadStageState,
  level: ReadLevel,
): void {
  const tell = stage.visible;
  if (tell) {
    // 刚露出来的一瞬淡入一点点 —— "他动了一下"的分量正在于它很短
    const p = Math.min(1, Math.max(0, (stage.elapsedMs - stage.visibleStartMs) / 180));
    const alpha = 0.4 + 0.6 * p;
    drawTellArt(g, tell, true, alpha);
  }

  drawProgress(g, stage, level);
}

/** 进度：看穿了几处（进度槽与刻度都来自模板，口径与判定是同一份） */
function drawProgress(
  g: Phaser.GameObjects.Graphics,
  stage: ReadStageState,
  level: ReadLevel,
): void {
  readProgressBar(g, level, stage.readCount);
  readTicks(g, level, stage.readIds);
}

/** 看懂了：把他真正的打算摊开在桌面上（还是没有刀 —— 只有那只伸向别处的手） */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _stage: ReadStageState,
  level: ReadLevel,
): void {
  const { x, y } = level.speaker;
  const tableY = y + FIGURE.tableY;
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(x, y + 40, 420);
  // 那只手终于不藏了：从袖子里伸出来，指尖指向桌子另一头
  const fromX = x - FIGURE.cuffX;
  const fromY = y + FIGURE.cuffY + 120;
  for (const width of [26, 7] as const) {
    g.lineStyle(width, width === 26 ? 0xf6d3ae : THEME.outline, 1);
    g.beginPath();
    g.moveTo(fromX, fromY);
    g.lineTo(x - 60, tableY - 30);
    g.lineTo(x + 210, tableY - 60);
    g.strokePath();
  }
  circle(g, x + 216, tableY - 62, 26, 0xf6d3ae, THEME.outline, 6);
  for (const dx of [40, 74, 108, 140] as const) {
    g.lineStyle(14, 0xf6d3ae, 1);
    g.lineBetween(x + dx, tableY - 46, x + dx + 20, tableY - 18);
    g.lineStyle(5, THEME.outline, 0.9);
    g.lineBetween(x + dx, tableY - 46, x + dx + 20, tableY - 18);
  }
}

/**
 * 分幕插图：① 他笑着说了很多好话 ② 眼神、袖口、手指一次一次出卖他
 * （两张图里都只有一只手、一只袖子、一双眼睛）
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.red, 0.9), 1);
  g.fillRoundedRect(x - 20, y - 10, w + 40, 90, 26);
  roundRect(g, x + w * 0.08, y + h * 0.66, w * 0.84, h * 0.2, 24, THEME.wood, THEME.outline, 6);
  circle(g, x + w * 0.3, y + h * 0.66, 20, THEME.gold, THEME.outline, 5);
  circle(g, x + w * 0.62, y + h * 0.68, 20, THEME.goldDeep, THEME.outline, 5);

  // 头与笑脸（两幕共用）
  const hx = x + w * 0.5;
  const hy = y + h * 0.34;
  roundRect(g, hx - 150, hy + 46, 300, h * 0.24, 60, shade(THEME.teal, 0.92), THEME.outline, 6);
  circle(g, hx, hy, 82, 0xf6d3ae, THEME.outline, 7);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(hx, hy - 50, 160, 76);
  for (const side of [-1, 1] as const) {
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(hx + side * 30, hy - 6, 24, 20);
  }
  g.lineStyle(7, THEME.outline, 0.9);
  g.beginPath();
  g.moveTo(hx - 30, hy + 36);
  g.lineTo(hx, hy + 48);
  g.lineTo(hx + 30, hy + 36);
  g.strokePath();

  if (index === 0) {
    // 第一幕：他满口好话 —— 三句话从嘴边飘出来
    for (const [dx, dy, r] of [
      [110, -30, 30],
      [160, 10, 22],
      [132, 52, 16],
    ] as const) {
      circle(g, hx + dx, hy + dy, r, THEME.card, THEME.outline, 5);
    }
    return;
  }
  // 第二幕：眼神飘出去、袖口收了一下、指尖在桌上敲
  g.lineStyle(9, THEME.inkSoft, 0.85);
  g.beginPath();
  g.moveTo(hx - 92, hy - 4);
  g.lineTo(hx - 158, hy - 26);
  g.strokePath();
  g.lineStyle(8, THEME.outline, 0.8);
  g.lineBetween(hx - 150, hy + 120, hx - 96, hy + 96);
  circle(g, hx + 128, y + h * 0.72, 24, 0xf6d3ae, THEME.outline, 5);
}
