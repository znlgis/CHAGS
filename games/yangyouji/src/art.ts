import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { AimStage } from '@chags/templates';
import { ADVANCE, ARCHER_X0, ARCHER_STEP, GROUND_Y, LEAVES, SKY_TOP } from './layout';

/** 柳叶：一片细长的叶子，越远画得越小 */
export function drawLeaf(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  state: 'live' | 'hit' | 'wait',
): void {
  // 画得比判定半径略小：远的那几片才不会挤在一起
  const w = radius * 0.9;
  const h = radius * 0.62;
  if (state === 'live') {
    g.fillStyle(THEME.gold, 0.28);
    g.fillCircle(x, y, radius + 26);
  }
  g.fillStyle(state === 'wait' ? shade(THEME.leaf, 0.92) : THEME.leaf, state === 'wait' ? 0.75 : 1);
  g.fillEllipse(x, y, w * 2, h * 2);
  g.lineStyle(5, THEME.outline, state === 'wait' ? 0.5 : 1);
  g.strokeEllipse(x, y, w * 2, h * 2);
  // 叶脉
  g.lineStyle(4, THEME.outline, state === 'wait' ? 0.35 : 0.8);
  g.lineBetween(x - w, y, x + w, y);
  // 叶柄
  g.lineStyle(5, THEME.woodDeep, 1);
  g.lineBetween(x + w, y, x + w + 16, y - 14);
  if (state === 'hit') {
    // 射穿了：叶子上一个洞，箭还钉在上面
    g.fillStyle(THEME.card, 1);
    g.fillCircle(x, y, Math.max(7, radius * 0.4));
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(x, y, Math.max(7, radius * 0.4));
    g.lineStyle(6, THEME.ink, 1);
    g.lineBetween(x - radius, y + radius, x + radius, y - radius);
    g.fillStyle(THEME.red, 1);
    g.fillTriangle(
      x - radius - 14, y + radius + 6,
      x - radius + 12, y + radius + 10,
      x - radius + 2, y + radius - 14,
    );
  }
}

/** 养由基：拉弓的人 */
export function drawArcher(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pull: number,
): void {
  groundShadow(g, x, y + 96, 130, 34, 0.18);
  // 腿与衣袍
  roundRect(g, x - 38, y - 6, 76, 116, 26, THEME.teal, THEME.outline, 6);
  // 头与发髻
  circle(g, x, y - 46, 30, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 66, 64, 28);
  g.fillCircle(x - 10, y - 46, 4);
  g.fillCircle(x + 10, y - 46, 4);
  // 弓：越用力拉得越满
  const bowX = x + 54;
  g.lineStyle(8, THEME.woodDeep, 1);
  g.beginPath();
  g.moveTo(bowX - 6, y - 96);
  g.lineTo(bowX + 18, y - 40);
  g.lineTo(bowX - 6, y + 16);
  g.strokePath();
  g.lineStyle(4, THEME.ink, 1);
  g.lineBetween(bowX - 6, y - 96, bowX - 6 - 26 * (1 - pull), y - 40);
  g.lineBetween(bowX - 6 - 26 * (1 - pull), y - 40, bowX - 6, y + 16);
  if (pull > 0.05) {
    g.lineStyle(6, THEME.ink, 1);
    g.lineBetween(bowX - 6 - 44 * pull, y - 40, bowX + 40, y - 44);
  }
}

/** 靶场：柳树、地面、一排刻着步数的木牌、"再退十步"的木牌 */
export function drawScenery(g: Phaser.GameObjects.Graphics, stage: AimStage): void {
  const W = DESIGN.width;
  const H = DESIGN.height;

  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, GROUND_Y - SKY_TOP);
  g.fillStyle(shade(THEME.skyDeep, 1.04), 1);
  g.fillEllipse(180, GROUND_Y - 30, 460, 200);
  g.fillEllipse(600, GROUND_Y - 10, 520, 170);
  // 草坡
  g.fillStyle(THEME.leaf, 1);
  g.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  g.fillStyle(shade(THEME.leaf, 0.86), 1);
  g.fillRect(0, GROUND_Y + 120, W, H - GROUND_Y - 120);

  // 柳树：树干立在地上，枝叶铺开 —— 五片叶子就挂在这上面
  roundRect(g, 250, 430, 66, GROUND_Y - 430, 26, THEME.wood, THEME.outline, 7);
  g.fillStyle(shade(THEME.leaf, 1.04), 1);
  for (const [cx, cy, r] of [[170, 320, 150], [300, 300, 122], [70, 392, 104], [392, 372, 88]] as const) {
    g.fillCircle(cx, cy, r);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeCircle(cx, cy, r);
  }
  // 垂下来的柳条
  g.lineStyle(5, shade(THEME.leaf, 0.8), 1);
  for (const [lx, ly, len] of [[60, 470, 150], [140, 500, 120], [330, 480, 140], [420, 450, 110]] as const) {
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(lx + 10, ly + len);
    g.strokePath();
  }

  // 地面上的步数刻度：每一档正好在弓箭手站的那一格
  for (let i = 0; i < 5; i += 1) {
    const sx = ARCHER_X0 + i * ARCHER_STEP;
    const done = i <= stage.rungIndex;
    g.fillStyle(done ? THEME.gold : shade(THEME.stone, 1.05), 1);
    g.fillRoundedRect(sx - 22, GROUND_Y + 40, 44, 20, 8);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRoundedRect(sx - 22, GROUND_Y + 40, 44, 20, 8);
    if (i === stage.rungIndex) {
      g.lineStyle(6, THEME.red, 0.85);
      g.strokeCircle(sx, GROUND_Y + 50, 42);
    }
  }

  // "再退十步"的木牌：射中了才亮
  const needAdvance =
    stage.hitIds.length > stage.rungIndex && stage.rungIndex < 4;
  roundRect(g, ADVANCE.x - 150, ADVANCE.y - 46, 300, 92, 34, needAdvance ? THEME.red : shade(THEME.wood, 1.05), THEME.outline, 6);
  roundRect(g, ADVANCE.x - 96, ADVANCE.y - 6, 192, 12, 6, THEME.paper, null, 0);

}

/** 收尾：一箭穿过百步外的柳叶，围观的人举起手 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.2);
  g.fillCircle(LEAVES[4]!.x, LEAVES[4]!.y, 260);
  g.lineStyle(9, THEME.gold, 0.7);
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14;
    g.lineBetween(
      LEAVES[4]!.x + Math.cos(angle) * 120,
      LEAVES[4]!.y + Math.sin(angle) * 120,
      LEAVES[4]!.x + Math.cos(angle) * 200,
      LEAVES[4]!.y + Math.sin(angle) * 200,
    );
  }
  // 树下围观的人群剪影，举起手
  for (let i = 0; i < 6; i += 1) {
    const x = 90 + i * 66;
    const y = 1300;
    g.fillStyle(THEME.ink, 0.55);
    g.fillCircle(x, y - 54, 20);
    g.fillRoundedRect(x - 24, y - 34, 48, 74, 20);
    g.lineStyle(9, THEME.ink, 0.55);
    g.lineBetween(x - 20, y - 20, x - 34, y - 74);
    g.lineBetween(x + 20, y - 20, x + 34, y - 74);
  }
}

/** 分幕插图：① 百步之外的柳叶 ② 一箭穿过柳叶 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.leaf, 1);
  g.fillRoundedRect(x - 20, y + h * 0.74, w + 40, h * 0.3, 30);
  roundRect(g, x + w * 0.24, y + h * 0.34, 46, 240, 18, THEME.wood, THEME.outline, 6);
  g.fillStyle(shade(THEME.leaf, 1.04), 1);
  for (const [cx, cy, r] of [[x + w * 0.3, y + h * 0.3, 92], [x + w * 0.52, y + h * 0.36, 76]] as const) {
    g.fillCircle(cx, cy, r);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeCircle(cx, cy, r);
  }
  drawLeaf(g, x + w * 0.42, y + h * 0.42, 30, index === 0 ? 'live' : 'hit');
  drawArcher(g, x + w * 0.78, y + h * 0.66, index === 0 ? 0.2 : 0);
}