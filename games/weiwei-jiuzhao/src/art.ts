import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import type { SiegeLevel, SiegeVital } from '@chags/templates/schemas';

/**
 * 画面要用的那部分 metrics。
 * 结构上与模板的 SiegeStageMetrics 对得上，但不依赖模板的类型导出 ——
 * 美术只关心"推了多少、哪些要害回防了"。
 */
export interface SiegeView {
  ratio: number;
  goal: number;
  resistance: number;
  relieved: string[];
  gain: number;
  done: boolean;
}

/** 摊开的地图：一切都画在这张图上 */
const MAP = { x: 30, y: 176, w: 690, h: 1120 } as const;

/** 一个小兵：身子 + 头 + 旗子（这一计的画面里没有兵器） */
function drawGuard(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  flag: boolean,
): void {
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - 16, y - 6, 32, 52, 12);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x - 16, y - 6, 32, 52, 12);
  circle(g, x, y - 28, 17, 0xf6d3ae, THEME.outline, 5);
  if (!flag) return;
  g.lineStyle(4, THEME.outline, 1);
  g.lineBetween(x + 18, y + 44, x + 18, y - 56);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x + 18, y - 56, x + 64, y - 44, x + 18, y - 30);
  g.lineStyle(4, THEME.outline, 1);
  g.strokeTriangle(x + 18, y - 56, x + 64, y - 44, x + 18, y - 30);
}

/** 一个站着的人（孙膑、田忌），pointing = 伸手指着地图 */
function drawPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  pointing: boolean,
): void {
  groundShadow(g, x, y + 84, 140, 32, 0.14);
  roundRect(g, x - 46, y - 70, 92, 156, 34, color, THEME.outline, 6);
  circle(g, x, y - 102, 36, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 116, 76, 32);
  if (!pointing) return;
  g.lineStyle(18, color, 1);
  g.lineBetween(x + 30, y - 40, x + 104, y - 4);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x + 30, y - 40, x + 104, y - 4);
  circle(g, x + 108, y - 2, 12, 0xf6d3ae, THEME.outline, 5);
}

/** 一辆马车（求救的马车一辆接一辆） */
function drawCart(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
  groundShadow(g, x, y + 34, 180, 26, 0.16);
  roundRect(g, x - 74, y - 46, 148, 66, 18, THEME.wood, THEME.outline, 6);
  roundRect(g, x - 46, y - 84, 96, 42, 14, color, THEME.outline, 6);
  for (const dx of [-46, 44] as const) {
    circle(g, x + dx, y + 28, 24, shade(THEME.stone, 0.9), THEME.outline, 6);
  }
  g.lineStyle(8, THEME.woodDeep, 1);
  g.lineBetween(x + 74, y - 10, x + 150, y - 34);
}

/** 地图上的山：山脊用两个三角形叠出来 */
function drawMountains(g: Phaser.GameObjects.Graphics): void {
  for (const [mx, my, s] of [[118, 640, 1], [186, 700, 0.66], [660, 1120, 0.8]] as const) {
    g.fillStyle(shade(THEME.leaf, 0.86), 1);
    g.fillTriangle(mx - 96 * s, my, mx, my - 150 * s, mx + 96 * s, my);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(mx - 96 * s, my, mx, my - 150 * s, mx + 96 * s, my);
    g.fillStyle(THEME.card, 0.9);
    g.fillTriangle(mx - 30 * s, my - 96 * s, mx, my - 150 * s, mx + 30 * s, my - 96 * s);
  }
}

/** 从我们的营地通往两处要害的路 */
function drawRoads(g: Phaser.GameObjects.Graphics, level: SiegeLevel): void {
  g.lineStyle(18, shade(THEME.sand, 0.84), 1);
  for (const vital of level.vital) {
    g.beginPath();
    g.moveTo(level.front.x, level.front.y - 40);
    g.lineTo((level.front.x + vital.x) / 2 + 40, (level.front.y + vital.y) / 2);
    g.lineTo(vital.x, vital.y);
    g.strokePath();
  }
}

/** 粮道：一条路 + 几袋粮食 + 一辆粮车 */
function drawGrainRoad(g: Phaser.GameObjects.Graphics, vital: SiegeVital): void {
  const { x, y } = vital;
  g.lineStyle(30, shade(THEME.sand, 0.78), 1);
  g.beginPath();
  g.moveTo(x - 170, y + 130);
  g.lineTo(x + 150, y - 120);
  g.strokePath();
  for (const [dx, dy] of [[-96, 76], [-20, 26], [56, -26]] as const) {
    circle(g, x + dx, y + dy, 24, THEME.goldDeep, THEME.outline, 5);
    circle(g, x + dx + 26, y + dy - 12, 18, THEME.gold, THEME.outline, 5);
  }
  drawCart(g, x + 120, y - 96, THEME.gold);
}

/** 大梁城门：城门 + 两座角楼 + 旗子 */
function drawCityGate(g: Phaser.GameObjects.Graphics, vital: SiegeVital): void {
  const { x, y } = vital;
  roundRect(g, x - 116, y - 46, 232, 132, 18, shade(THEME.stone, 1.04), THEME.outline, 7);
  roundRect(g, x - 40, y + 20, 80, 66, { tl: 40, tr: 40, bl: 0, br: 0 }, shade(THEME.wood, 0.72), THEME.outline, 6);
  for (const dx of [-116, 72] as const) {
    roundRect(g, x + dx, y - 118, 44, 86, 12, shade(THEME.stone, 0.94), THEME.outline, 6);
    g.fillStyle(THEME.red, 1);
    g.fillTriangle(x + dx - 6, y - 118, x + dx + 22, y - 170, x + dx + 50, y - 118);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(x + dx - 6, y - 118, x + dx + 22, y - 170, x + dx + 50, y - 118);
  }
  drawGuard(g, x - 8, y - 176, THEME.red, true);
}

/** 一处要害：自己的一圈"可以点这里"，回防之后插上旗 */
function drawVitalSite(g: Phaser.GameObjects.Graphics, vital: SiegeVital, relieved: boolean): void {
  const { x, y, radius } = vital;
  groundShadow(g, x, y + radius + 30, radius * 2.4, 42, 0.14);
  if (vital.id === 'grain') drawGrainRoad(g, vital);
  else drawCityGate(g, vital);

  g.lineStyle(8, relieved ? THEME.teal : THEME.red, 0.82);
  g.strokeCircle(x, y, radius);
  g.lineStyle(5, relieved ? THEME.teal : THEME.red, 0.35);
  g.strokeCircle(x, y, radius + 16);
  if (relieved) {
    // 兵马来回防了：要害旁边多一面旗、一队人
    drawGuard(g, x - radius - 10, y + radius - 16, THEME.teal, true);
  }
}

/** 正面：推不动的城墙 + 我们这边的推车 */
function drawFront(g: Phaser.GameObjects.Graphics, level: SiegeLevel, stage: SiegeView): void {
  const { x, y, radius } = level.front;
  const pushed = stage.ratio * 42;
  const cx = x - pushed;
  groundShadow(g, cx, y + radius + 34, radius * 3.1, 52, 0.18);

  roundRect(g, cx - radius * 1.5, y - radius, radius * 3, radius * 1.6, 24, shade(THEME.stone, 1.05), THEME.outline, 7);
  for (let i = 0; i < 4; i += 1) {
    roundRect(g, cx - radius * 1.5 + 18 + i * radius * 0.72, y - radius - 40, radius * 0.46, 46, 10, shade(THEME.stone, 0.92), THEME.outline, 5);
  }
  roundRect(g, cx - 58, y - 4, 116, radius * 1.6 + 4, { tl: 58, tr: 58, bl: 0, br: 0 }, shade(THEME.wood, 0.74), THEME.outline, 6);

  // 阻力还在的时候，城墙底下压着一层厚厚的夯土 —— 推不动的样子
  const heavy = Math.min(1, stage.resistance / 8);
  g.fillStyle(shade(THEME.stone, 0.72), 0.55);
  g.fillRoundedRect(cx - radius * 1.6, y + radius * 0.6, radius * 3.2, 16 + 34 * heavy, 14);

  // 守军：回防一处，城墙上就少一队
  const guards = Math.max(0, 3 - stage.relieved.length);
  for (let i = 0; i < guards; i += 1) {
    drawGuard(g, cx - radius + 40 + i * 84, y - radius - 92, THEME.red, i === 0);
  }

  // 我们这边：推车 + 推车的人
  const cartY = y + radius + 104;
  drawCart(g, cx + 10, cartY, THEME.teal);
  drawGuard(g, cx - 118, cartY - 34, THEME.teal, false);
  drawGuard(g, cx + 128, cartY - 34, THEME.teal, false);
  if (stage.gain < 1) {
    // 推不动：车底下扬起一圈土
    g.lineStyle(6, shade(THEME.stone, 0.8), 0.9);
    for (const dx of [-96, -62, 70, 104] as const) {
      g.beginPath();
      g.moveTo(cx + dx, cartY + 40);
      g.lineTo(cx + dx + 18, cartY + 22);
      g.lineTo(cx + dx + 36, cartY + 44);
      g.strokePath();
    }
  }
}

/** 进度条：推到 goal 就解围 */
function drawProgress(g: Phaser.GameObjects.Graphics, stage: SiegeView): void {
  const x = 150;
  const y = 212;
  const w = 450;
  const h = 54;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  const inner = w - 12;
  const fill = Math.max(0, Math.min(inner, inner * stage.ratio));
  if (fill > 8) {
    roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, stage.done ? THEME.gold : THEME.red, null, 0);
  }
  g.lineStyle(6, THEME.outline, 0.85);
  g.lineBetween(x + w - 8, y - 12, x + w - 8, y + h + 12);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x + w - 8, y - 12, x + w - 8, y - 34, x + w - 44, y - 12);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x + w - 8, y - 12, x + w - 8, y - 34, x + w - 44, y - 12);
}

/** 整屏画面：一张地图，左边推不动的城墙，右边两处要害 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: SiegeView,
  level: SiegeLevel,
): void {
  roundRect(g, MAP.x, MAP.y, MAP.w, MAP.h, 44, 0xf6e6c4, THEME.outline, 7);
  wavyBand(g, MAP.x + 10, 776, MAP.w - 20, 84, THEME.water, 0.9, 9, 1.6, 30);
  drawMountains(g);
  drawRoads(g, level);
  for (const vital of level.vital) {
    drawVitalSite(g, vital, stage.relieved.includes(vital.id));
  }
  drawFront(g, level, stage);
  drawProgress(g, stage);
}

/** 点中要害：兵马拉起来回防（一次短暂的过场，不参与每帧重画） */
export function playWithdraw(
  scene: Phaser.Scene,
  vital: SiegeVital,
  level: SiegeLevel,
): void {
  const from = { x: level.front.x - 20, y: level.front.y - level.front.radius - 20 };
  for (let i = 0; i < 3; i += 1) {
    const g = scene.add.graphics().setDepth(30);
    drawGuard(g, 0, 0, THEME.red, i === 0);
    g.setPosition(from.x + i * 52, from.y - i * 24);
    scene.tweens.add({
      targets: g,
      x: vital.x - 70 + i * 70,
      y: vital.y + vital.radius - 4,
      duration: 700 + i * 110,
      delay: i * 80,
      ease: 'Sine.easeInOut',
      onComplete: () => g.destroy(),
    });
  }
}

/** 解围：城门大开，金色的光从城里透出来 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _stage: SiegeView,
  level: SiegeLevel,
): void {
  const { x, y, radius } = level.front;
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(x, y, radius * 2.6);
  roundRect(g, x - 58, y - 4, 116, radius * 1.6 + 4, { tl: 58, tr: 58, bl: 0, br: 0 }, THEME.gold, THEME.outline, 6);
  for (const vital of level.vital) {
    g.lineStyle(10, THEME.gold, 0.55);
    g.strokeCircle(vital.x, vital.y, vital.radius);
  }
}

/** 分幕插图：① 邯郸被围，求救的马车一辆接一辆 ② 孙膑指着地图说话 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.92), 1);
  g.fillRoundedRect(x - 20, y + h * 0.62, w + 40, h * 0.42, 30);

  if (index === 0) {
    // 邯郸被围：城墙上站着守军，城门关着；城下求救的马车一辆接一辆
    drawGuard(g, x + w * 0.2, y + h * 0.4, THEME.red, true);
    roundRect(g, x + w * 0.16, y + h * 0.46, w * 0.56, h * 0.2, 18, shade(THEME.stone, 1.05), THEME.outline, 7);
    roundRect(g, x + w * 0.38, y + h * 0.52, w * 0.12, h * 0.14, { tl: 30, tr: 30, bl: 0, br: 0 }, shade(THEME.wood, 0.72), THEME.outline, 6);
    drawCart(g, x + w * 0.24, y + h * 0.86, THEME.gold);
    drawCart(g, x + w * 0.72, y + h * 0.92, THEME.teal);
    g.lineStyle(7, shade(THEME.sand, 0.8), 1);
    g.lineBetween(x + w * 0.42, y + h * 0.78, x + w * 0.62, y + h * 0.7);
    return;
  }

  // 孙膑指着地图：桌上摊着地图，一条金线从邯郸划到大梁
  roundRect(g, x + w * 0.12, y + h * 0.58, w * 0.76, h * 0.26, 20, THEME.card, THEME.outline, 6);
  circle(g, x + w * 0.3, y + h * 0.74, 16, THEME.red, THEME.outline, 5);
  circle(g, x + w * 0.66, y + h * 0.64, 16, THEME.teal, THEME.outline, 5);
  g.lineStyle(8, THEME.gold, 1);
  g.lineBetween(x + w * 0.34, y + h * 0.72, x + w * 0.6, y + h * 0.65);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x + w * 0.62, y + h * 0.62, x + w * 0.52, y + h * 0.62, x + w * 0.58, y + h * 0.55);
  drawPerson(g, x + w * 0.3, y + h * 0.36, THEME.teal, true);
  drawPerson(g, x + w * 0.7, y + h * 0.34, THEME.red, false);
}
