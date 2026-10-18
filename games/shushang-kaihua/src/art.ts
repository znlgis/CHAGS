import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { showBorrowBar } from '@chags/templates';
import type { ShowBorrowMetrics } from '@chags/templates';
import type { ShowBorrowLevel } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';
import {
  BRIDGE, DESIGN_H, DESIGN_W, ENEMY, FAR_BANK_BOTTOM, PROPS, PROP_RADIUS, RIVER_BOTTOM,
  RIVER_TOP, SKY_TOP, ZHANG_FEI,
} from './layout';

/**
 * 第 29 计的这一屏：**没有一场交战**。
 *
 * 一条河把画面分成两半：北岸是追兵来的方向，南岸是我们要护住的人。
 * 张飞横矛站在南桥头，手里只有几面旗 —— 旗挂到对岸的林子、土坡与北桥头上，
 * 那一片尘土与旗号就让对面觉得"后面还有大军"。
 * 旗越多、挂得越显眼，北岸的尘土就越大：**势是看得见的**。
 */

const SKIN = 0xf8dcbb;
const GRASS = 0xd9e3b4;
const GRASS_DEEP = 0xbccb92;
const HILL_FAR = 0xa9c0ae;
const HILL_NEAR = 0x8fb096;
const WATER = THEME.water;
const WATER_LIGHT = 0x8fd0ef;
const PLANK = 0xcaa977;
const PLANK_DEEP = 0x9c7c4f;
const DUST = 0xe8d9b4;


// ---------------- 小零件 ----------------

/** 一面旗：杆 + 三角旗面（旗面朝右飘一点） */
function drawFlag(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  color: number,
  wobble = 0,
): void {
  const top = y - 104 * s;
  const tip = { x: x + 64 * s + wobble, y: y - 74 * s };
  g.lineStyle(7 * s, THEME.outline, 1);
  g.lineBetween(x, y, x, top);
  g.fillStyle(color, 1);
  g.fillTriangle(x, top, x, top + 62 * s, tip.x, tip.y);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x, top, x, top + 62 * s, tip.x, tip.y);
}

/** 支点上挂着的旗：以支点为中心摊开一排（谁挂了几面一眼看得出来） */
function drawHungFlags(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  count: number,
  t: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const dx = (i - (count - 1) / 2) * 62;
    const wobble = Math.sin(t / 460 + i * 1.7) * 7;
    drawFlag(g, x + dx, y + 26 + Math.abs(dx) * 0.16, 0.72, THEME.teal, wobble);
  }
}

/** 一棵树（林子那一片就是这个的重复） */
function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  groundShadow(g, x, y + 10 * s, 96 * s, 26 * s, 0.16);
  g.lineStyle(13 * s, shade(THEME.wood, 0.9), 1);
  g.lineBetween(x, y, x, y - 44 * s);
  for (let i = 0; i < 2; i += 1) {
    const top = y - 128 * s + i * 52 * s;
    g.fillStyle(shade(THEME.leaf, 1 - i * 0.08), 1);
    g.fillTriangle(x - 58 * s, top + 58 * s, x + 58 * s, top + 58 * s, x, top);
    g.lineStyle(6 * s, THEME.outline, 0.75);
    g.strokeTriangle(x - 58 * s, top + 58 * s, x + 58 * s, top + 58 * s, x, top);
  }
}

/** 一座土坡 */
function drawMound(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 44, 250, 54, 0.16);
  g.fillStyle(GRASS_DEEP, 1);
  g.fillEllipse(x, y + 26, 244, 118);
  g.lineStyle(6, THEME.outline, 0.7);
  g.strokeEllipse(x, y + 26, 244, 118);
  g.fillStyle(shade(GRASS_DEEP, 1.06), 1);
  for (let i = 0; i < 5; i += 1) {
    const gx = x - 78 + i * 39;
    g.fillTriangle(gx - 10, y + 12, gx + 10, y + 12, gx, y - 20);
  }
}

/** 北桥头：两根木柱，挂着一盏灯（旗就系在这两根柱子上） */
function drawBridgeHead(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  for (const side of [-1, 1]) {
    const px = x + side * 98;
    roundRect(g, px - 17, y - 128, 34, 168, 12, PLANK, THEME.outline, 6);
    circle(g, px, y - 146, 19, THEME.gold, THEME.outline, 5);
  }
  g.lineStyle(12, PLANK_DEEP, 1);
  g.lineBetween(x - 98, y - 118, x + 98, y - 118);
}

/** 张飞：横矛站在南桥头（旗撑着场面，他撑着胆） */
function drawZhangFei(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 12, 118, 30, 0.2);
  // 长矛（横着拿）
  g.lineStyle(11, shade(THEME.wood, 0.86), 1);
  g.lineBetween(x - 96, y - 96, x + 92, y - 168);
  g.fillStyle(THEME.stone, 1);
  g.fillTriangle(x + 92, y - 168, x + 128, y - 190, x + 96, y - 150);
  // 身子与披风
  roundRect(g, x - 40, y - 118, 80, 118, 26, shade(THEME.redDeep, 1.05), THEME.outline, 6);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x - 40, y - 112, x - 92, y - 8, x - 30, y - 6);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 40, y - 112, x - 92, y - 8, x - 30, y - 6);
  // 头与头盔
  circle(g, x, y - 138, 30, SKIN, THEME.outline, 6);
  circle(g, x, y - 156, 25, THEME.inkSoft, THEME.outline, 5);
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x - 12, y - 140, x - 2, y - 140);
  g.lineBetween(x + 8, y - 140, x + 18, y - 140);
}

/** 天边的追兵：看得见旗号与尘土，看不清人 */
function drawEnemy(g: Phaser.GameObjects.Graphics, x: number, y: number, dust: number, t: number): void {
  for (let i = 0; i < 3; i += 1) {
    const ex = x - 74 + i * 62;
    const ey = y + i * 16;
    groundShadow(g, ex, ey + 6, 44, 12, 0.14);
    roundRect(g, ex - 13, ey - 46, 26, 44, 12, shade(THEME.inkSoft, 0.9), THEME.outline, 4);
    circle(g, ex, ey - 56, 13, SKIN, THEME.outline, 4);
    drawFlag(g, ex + 18, ey, 0.42, THEME.red);
  }
  // 尘土：挂的旗越多，这边的烟尘越大（势是看得见的）
  for (let i = 0; i < 7; i += 1) {
    const p = i / 6;
    const puff = 30 + 118 * dust * (0.5 + 0.5 * Math.sin(t / 900 + i));
    if (puff <= 4) continue;
    g.fillStyle(DUST, 0.16 + 0.34 * dust);
    g.fillCircle(x - 190 + i * 62 + Math.sin(t / 700 + i * 2) * 14, y + 50 - p * 30, puff);
  }
}

// ---------------- 景 ----------------

/** 天、对岸的草地、河与南岸 */
function drawLand(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(GRASS, 1);
  g.fillRect(0, SKY_TOP, DESIGN_W, FAR_BANK_BOTTOM - SKY_TOP);
  g.fillStyle(GRASS_DEEP, 1);
  g.fillRect(0, FAR_BANK_BOTTOM - 44, DESIGN_W, 44);

  // 北岸的天边：两道远山（追兵就是从这儿来的）
  for (let i = 0; i < 5; i += 1) {
    const x = 46 + i * 172;
    const top = 176 + ((i * 41) % 34);
    g.fillStyle(HILL_FAR, 1);
    g.fillTriangle(x - 124, 292, x + 124, 292, x, top);
    g.lineStyle(5, shade(HILL_FAR, 0.84), 1);
    g.strokeTriangle(x - 124, 292, x + 124, 292, x, top);
  }

  // 河
  g.fillStyle(WATER, 1);
  g.fillRect(0, RIVER_TOP, DESIGN_W, RIVER_BOTTOM - RIVER_TOP);
  g.fillStyle(shade(WATER, 0.86), 1);
  g.fillRect(0, RIVER_BOTTOM - 26, DESIGN_W, 26);
  wavyBand(g, -40, RIVER_TOP + 12, DESIGN_W + 80, 120, WATER_LIGHT, 0.5, 10, 3.4);
  wavyBand(g, -40, RIVER_TOP + 116, DESIGN_W + 80, 120, shade(WATER_LIGHT, 0.96), 0.35, 8, 2.6);

  // 南岸：身后两道矮丘（我们要护住的人就在这儿）
  for (let i = 0; i < 3; i += 1) {
    const x = 120 + i * 250;
    const top = DESIGN_H - 150 - ((i * 29) % 30);
    g.fillStyle(HILL_NEAR, 1);
    g.fillTriangle(x - 176, DESIGN_H + 30, x + 176, DESIGN_H + 30, x, top);
    g.lineStyle(5, shade(HILL_NEAR, 0.82), 1);
    g.strokeTriangle(x - 176, DESIGN_H + 30, x + 176, DESIGN_H + 30, x, top);
  }
  g.fillStyle(GRASS, 1);
  g.fillRect(0, RIVER_BOTTOM, DESIGN_W, DESIGN_H - RIVER_BOTTOM);
  g.fillStyle(shade(GRASS, 0.96), 1);
  g.fillRect(0, RIVER_BOTTOM, DESIGN_W, 30);
}

/** 桥：从北岸跨到南岸的一条木桥（大军要过来，就得从这儿过） */
function drawBridge(g: Phaser.GameObjects.Graphics): void {
  const { x, top, bottom, halfWidth } = BRIDGE;
  groundShadow(g, x, bottom + 26, halfWidth * 2.2, 44, 0.18);
  roundRect(g, x - halfWidth, top - 18, halfWidth * 2, bottom - top + 60, 14, PLANK_DEEP, THEME.outline, 7);
  roundRect(g, x - halfWidth + 14, top - 6, halfWidth * 2 - 28, bottom - top + 40, 12, PLANK, THEME.outline, 6);
  // 木板缝
  g.lineStyle(5, PLANK_DEEP, 0.55);
  for (let i = 0; i < 9; i += 1) {
    const py = top + 16 + i * ((bottom - top) / 9);
    g.lineBetween(x - halfWidth + 18, py, x + halfWidth - 18, py);
  }
  // 两边的栏杆
  g.lineStyle(9, shade(PLANK, 0.86), 1);
  g.lineBetween(x - halfWidth + 8, top, x - halfWidth + 8, bottom + 20);
  g.lineBetween(x + halfWidth - 8, top, x + halfWidth - 8, bottom + 20);
}

/** 三个支点：旗就挂在它们身上（关卡数据里的坐标必须落在这儿） */
function drawProp(g: Phaser.GameObjects.Graphics, propId: string, x: number, y: number): void {
  if (propId === 'woods') {
    drawTree(g, x - 34, y + 16, 1);
    drawTree(g, x + 62, y + 34, 0.78);
    return;
  }
  if (propId === 'mound') {
    drawMound(g, x, y);
    return;
  }
  drawBridgeHead(g, x, y);
}

export function drawWorld(g: Phaser.GameObjects.Graphics, level: ShowBorrowLevel): void {
  drawLand(g);
  drawBridge(g);
  // 三个支点：关卡脚本说在哪儿，景就画在哪儿
  for (const prop of level.props) {
    const spot = PROPS.find((item) => item.id === prop.id);
    if (spot === undefined) continue;
    drawProp(g, prop.id, spot.x, spot.y);
  }
  drawEnemy(g, ENEMY.x, ENEMY.y, 0, 0);
  drawZhangFei(g, ZHANG_FEI.x, ZHANG_FEI.y);
  // 河边几块石头
  for (const [sx, sy, sr] of [[92, 1016, 18], [664, 1042, 14], [560, 1120, 12]] as const) {
    circle(g, sx, sy, sr, shade(THEME.stone, 1.04), THEME.outline, 4);
  }
}

// ---------------- 每帧 ----------------

/** 每帧：支点上挂着的旗、手里还剩的旗、天边的尘土、规模条 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: ShowBorrowMetrics,
  level: ShowBorrowLevel,
): void {
  const t = stage.elapsedMs;
  // 挂出来的旗（支点的位置来自关卡脚本，与美术互锁）
  for (const prop of level.props) {
    const count = stage.hanging[prop.id] ?? 0;
    if (count <= 0) continue;
    drawHungFlags(g, prop.x, prop.y, count, t);
  }
  // 对岸的尘土：挂出来的规模越大，那边越像有大军
  drawEnemy(g, ENEMY.x, ENEMY.y, clamp01(stage.ratio), t);
  // 手里还剩的旗：捆在南岸左边的草地上（一看就知道还有几面没挂出去）
  for (let i = 0; i < stage.flagsLeft; i += 1) {
    drawFlag(g, 64 + i * 32, 1178 + (i % 2) * 10, 0.5, THEME.gold, Math.sin(t / 520 + i) * 4);
  }
  showBorrowBar(g, level, stage.scale);
  // 刚动过的那个支点上亮一下（挂上 / 撤下都亮）
  const last = PROPS.find((item) => item.id === stage.lastPropId);
  const since = t - stage.lastAtMs;
  if (last !== undefined && since >= 0 && since <= 420) {
    const p = since / 420;
    g.lineStyle(9, THEME.gold, 0.8 * (1 - p));
    g.strokeCircle(last.x, last.y, PROP_RADIUS + 12 + 44 * p);
  }
}

/** 收尾：对岸整片亮起来 —— 借来的势成了真的胆 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: ShowBorrowMetrics,
  level: ShowBorrowLevel,
): void {
  g.fillStyle(THEME.gold, 0.1);
  g.fillRect(0, SKY_TOP, DESIGN_W, FAR_BANK_BOTTOM - SKY_TOP);
  g.lineStyle(12, THEME.gold, 0.5);
  g.strokeCircle(ENEMY.x, ENEMY.y, 150);
  for (const prop of level.props) {
    const count = Math.max(1, stage.hanging[prop.id] ?? 0);
    const wobble = Math.sin(stage.elapsedMs / 460) * 4;
    drawFlag(g, prop.x + count * 6, prop.y - 30, 1, THEME.gold, wobble);
  }
  g.fillStyle(THEME.gold, 0.22);
  g.fillCircle(ZHANG_FEI.x, ZHANG_FEI.y - 118, 96);
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 桥头只有张飞与二十来骑 ② 马尾拖树枝扬起尘土，对面看着像大军 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(GRASS, 1);
  g.fillRoundedRect(x, y + h * 0.52, w, h * 0.48, 30);
  g.fillStyle(WATER, 1);
  g.fillRect(x, y + h * 0.66, w, h * 0.16);
  g.lineStyle(12, PLANK_DEEP, 1);
  g.lineBetween(x + w * 0.5, y + h * 0.56, x + w * 0.5, y + h * 0.94);
  g.lineStyle(12, PLANK, 1);
  g.lineBetween(x + w * 0.5, y + h * 0.56, x + w * 0.5, y + h * 0.94);

  if (index === 0) {
    // ① 人少：桥上只有一个人，身后跟着两三骑
    drawZhangFei(g, x + w * 0.5, y + h * 0.72);
    for (let i = 0; i < 3; i += 1) {
      const rx = x + w * 0.5 - 74 - i * 42;
      circle(g, rx, y + h * 0.74, 15, shade(THEME.inkSoft, 0.92), THEME.outline, 4);
      g.lineStyle(9, shade(THEME.wood, 0.9), 1);
      g.lineBetween(rx, y + h * 0.74 + 12, rx, y + h * 0.74 + 34);
    }
    return;
  }

  // ② 借势：马尾上拖着树枝，扬起的尘土盖住了半个画面
  for (let i = 0; i < 5; i += 1) {
    const cx = x + w * 0.16 + i * w * 0.16;
    g.fillStyle(DUST, 0.5);
    g.fillCircle(cx, y + h * 0.42 - (i % 2) * 18, 44);
  }
  for (let i = 0; i < 4; i += 1) {
    const fx = x + w * 0.2 + i * w * 0.2;
    const fy = y + h * 0.5;
    circle(g, fx, fy, 17, shade(THEME.inkSoft, 0.9), THEME.outline, 4);
    g.lineStyle(9, shade(THEME.wood, 0.86), 1);
    g.lineBetween(fx + 12, fy + 30, fx + 46, fy + 54);
    drawFlag(g, fx + 8, fy + 6, 0.46, THEME.gold);
  }
}
