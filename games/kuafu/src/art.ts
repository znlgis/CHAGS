import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';

const GROUND_Y = 900;

/** 夸父：比常人大一号的巨人，跑起来手臂腿都在摆 */
export function drawKuafu(
  g: Phaser.GameObjects.Graphics,
  x: number,
  groundY: number,
  timeMs: number,
  running: boolean,
): void {
  const swing = running ? Math.sin(timeMs / 90) : 0;
  const bob = running ? Math.abs(Math.cos(timeMs / 90)) * 6 : 0;
  const y = groundY - bob;

  groundShadow(g, x, groundY + 8, 130, 26, 0.18);

  // 腿
  g.lineStyle(24, shade(THEME.red, 0.75), 1);
  g.beginPath();
  g.moveTo(x, y - 110);
  g.lineTo(x + 15 + swing * 38, y - 4);
  g.strokePath();
  g.beginPath();
  g.moveTo(x, y - 110);
  g.lineTo(x - 15 - swing * 38, y - 4);
  g.strokePath();

  // 身体
  roundRect(g, x - 46, y - 250, 92, 150, 34, THEME.red, THEME.outline, 7);

  // 手臂
  g.lineStyle(20, THEME.red, 1);
  g.beginPath();
  g.moveTo(x - 30, y - 220);
  g.lineTo(x - 60 - swing * 30, y - 120);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + 30, y - 220);
  g.lineTo(x + 60 + swing * 30, y - 130);
  g.strokePath();

  // 头
  circle(g, x, y - 292, 44, 0xf6d3ae, THEME.outline, 7);
  g.fillStyle(THEME.ink, 1);
  for (let i = -2; i <= 2; i += 1) g.fillCircle(x + i * 15, y - 330, 11);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 15, y - 294, 5);
  g.fillCircle(x + 15, y - 294, 5);

  // 手杖
  g.lineStyle(12, THEME.woodDeep, 1);
  g.lineBetween(x + 74, y - 250, x + 92, y - 10);
}

/** 分幕插图 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.sand, 1);
  g.fillRect(x, y + h - 150, w, 150);

  const sunX = index === 0 ? x + w - 150 : x + w - 110;
  const sunY = index === 0 ? y + 120 : y + 210;
  g.fillStyle(THEME.gold, 1);
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * 2 * i) / 10;
    g.lineStyle(6, THEME.gold, 1);
    g.lineBetween(sunX + Math.cos(a) * 44, sunY + Math.sin(a) * 44, sunX + Math.cos(a) * 62, sunY + Math.sin(a) * 62);
  }
  g.fillCircle(sunX, sunY, 40);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(sunX, sunY, 40);

  g.fillStyle(THEME.sandDeep, 1);
  g.fillTriangle(x + 60, y + h - 150, x + 210, y + h - 150, x + 135, y + h - 330);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x + 60, y + h - 150, x + 210, y + h - 150, x + 135, y + h - 330);

  drawKuafu(g, x + 250, y + h - 60, 0, false);
}

export interface KuafuStage {
  width: number;
  height: number;
  eased: number;
}

/** 场景：太阳沿弧线跑，夸父在后面追；山在后退 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: KuafuStage,
  timeMs: number,
  drinking: boolean,
): void {
  const warmth = stage.eased;

  // 天：越追越暖（接近日落）
  g.fillStyle(shade(THEME.sky, 1 - warmth * 0.12), 1);
  g.fillRect(0, 150, stage.width, GROUND_Y - 150);
  g.fillStyle(0xf7c948, 0.1 + warmth * 0.25);
  g.fillRect(0, 150, stage.width, GROUND_Y - 150);

  // 远处的山在后退
  g.fillStyle(THEME.sandDeep, 0.55);
  for (let i = 0; i < 6; i += 1) {
    const raw = i * 250 - stage.eased * 760;
    const mx = ((raw % 1500) + 1500) % 1500 - 260;
    g.fillTriangle(mx, GROUND_Y, mx + 200, GROUND_Y, mx + 100, GROUND_Y - 210);
  }

  // 大地
  g.fillStyle(THEME.sand, 1);
  g.fillRect(0, GROUND_Y, stage.width, stage.height - GROUND_Y);

  // 黄河、渭水：追到这里可以喝一口
  const riverX = 900 - stage.eased * 700;
  if (riverX > -200 && riverX < stage.width + 200) {
    g.fillStyle(THEME.water, 1);
    g.fillEllipse(riverX, GROUND_Y + 90, 260, 120);
    g.lineStyle(6, THEME.outline, 0.7);
    g.strokeEllipse(riverX, GROUND_Y + 90, 260, 120);
  }

  // 太阳沿弧线前进
  const sunX = 190 + stage.eased * 460;
  const sunY = 640 - Math.sin(stage.eased * Math.PI) * 420;
  g.fillStyle(0xf7c948, 1);
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    g.lineStyle(6, 0xf7c948, 0.9);
    g.lineBetween(sunX + Math.cos(a) * 50, sunY + Math.sin(a) * 50, sunX + Math.cos(a) * 70, sunY + Math.sin(a) * 70);
  }
  g.fillCircle(sunX, sunY, 46);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(sunX, sunY, 46);

  // 夸父在后面追
  const kuafuX = 60 + stage.eased * 480;
  drawKuafu(g, kuafuX, GROUND_Y + 40, timeMs, !drinking && stage.eased < 1);

  // 喝水提示
  if (drinking) {
    g.fillStyle(THEME.card, 0.9);
    g.fillCircle(kuafuX, GROUND_Y - 380, 44);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeCircle(kuafuX, GROUND_Y - 380, 44);
    g.fillStyle(THEME.water, 1);
    g.fillTriangle(kuafuX, GROUND_Y - 400, kuafuX - 18, GROUND_Y - 368, kuafuX + 18, GROUND_Y - 368);
    g.fillCircle(kuafuX, GROUND_Y - 362, 16);
  }
}

/**
 * 收尾：他倒下的地方，长出了一片桃林。
 *
 * 这里重画整幕而不是叠加 —— 因为画面上不该再站着夸父：
 * 留下的不是他跑没追上，而是他留下的那片桃林。
 */
export function drawFinale(g: Phaser.GameObjects.Graphics, stage: KuafuStage): void {
  // 夕阳西下
  g.fillStyle(0xf6d9a8, 1);
  g.fillRect(0, 150, stage.width, GROUND_Y - 150);
  g.fillStyle(0xf7b96a, 0.35);
  g.fillRect(0, 150, stage.width, GROUND_Y - 150);
  g.fillStyle(0xf7c948, 1);
  g.fillCircle(stage.width - 130, GROUND_Y - 300, 58);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(stage.width - 130, GROUND_Y - 300, 58);

  // 大地
  g.fillStyle(THEME.sand, 1);
  g.fillRect(0, GROUND_Y, stage.width, stage.height - GROUND_Y);
  g.fillStyle(THEME.leaf, 0.5);
  g.fillRect(0, GROUND_Y, stage.width, 40);

  // 桃林：高矮不一，有枝有花
  const trees: [number, number][] = [
    [110, 1.0], [250, 0.78], [390, 1.12], [530, 0.86], [660, 1.0],
  ];
  for (const [x, s] of trees) {
    groundShadow(g, x, GROUND_Y + 96, 120 * s, 26, 0.14);
    g.lineStyle(18 * s, THEME.woodDeep, 1);
    g.beginPath();
    g.moveTo(x, GROUND_Y + 90);
    g.lineTo(x + 6, GROUND_Y - 40 * s);
    g.strokePath();
    g.lineStyle(11 * s, THEME.woodDeep, 1);
    g.lineBetween(x + 4, GROUND_Y + 10, x - 40 * s, GROUND_Y - 60 * s);
    g.lineBetween(x + 4, GROUND_Y - 10, x + 46 * s, GROUND_Y - 76 * s);

    g.fillStyle(0xefa2bb, 1);
    g.fillCircle(x + 6, GROUND_Y - 130 * s, 62 * s);
    g.fillCircle(x - 48 * s, GROUND_Y - 88 * s, 40 * s);
    g.fillCircle(x + 56 * s, GROUND_Y - 100 * s, 44 * s);
    g.fillStyle(0xffd6e2, 1);
    g.fillCircle(x - 10 * s, GROUND_Y - 158 * s, 34 * s);
    g.fillCircle(x + 40 * s, GROUND_Y - 142 * s, 26 * s);
    g.lineStyle(5, THEME.outline, 0.45);
    g.strokeCircle(x + 6, GROUND_Y - 130 * s, 62 * s);
  }

  // 花瓣在飘
  g.fillStyle(0xffd6e2, 0.9);
  for (const [px, py, r] of [[180, 560, 9], [330, 470, 7], [500, 520, 8], [620, 430, 6], [270, 640, 7]] as const) {
    g.fillCircle(px, py, r);
  }
}
