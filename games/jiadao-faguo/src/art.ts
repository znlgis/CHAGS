import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { CHAIN_TIMING, DESIGN, chainProgressBar } from '@chags/templates';
import type { ChainLevel, ChainStageState } from '@chags/templates';
import {
  CAPITAL, ENVOY, GATE_RADIUS, GATES, HOME, ROAD_WIDTH, ROUTE, SKY_TOP,
} from './layout';

/**
 * 第 24 计的这一屏：**没有交战**。
 *
 * 一条从南边晋营通往北边虢都的土路：先在虞君的营帐谈成借路，
 * 再沿着借来的路一关一关往北（虞关 → 虢关 → 上阳关），最后原路回师。
 * 走的每一步都会把身后的路点亮 —— 这条亮着金光的路，就是虞国借出去的那条。
 */

const W = DESIGN.width;
const H = DESIGN.height;
const SKIN = 0xf8dcbb;
const FIELD = 0xf0e3c0;
const FIELD_DEEP = 0xdfcda4;
const HILL_FAR = 0xa9c0ae;
const HILL_NEAR = 0x8fb096;
const ROAD_COLOR = 0xcaa977;
const ROAD_LIGHT = 0xdfc497;
const WALL = 0xb3a68d;
const WALL_DEEP = 0x8e8270;
const TENT = 0xd9b46a;
const CITY = 0xd0a06a;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// ---------------- 路 ----------------

/** 路点的方向：这一点前后两个路点连起来，就是路在这一点的走向 */
function routeAngle(index: number): number {
  const from = ROUTE[Math.max(0, index - 1)]!;
  const to = ROUTE[Math.min(ROUTE.length - 1, index + 1)]!;
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** 这是路点里的第几个（关口就落在路点上） */
function routeIndexOf(x: number, y: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  ROUTE.forEach((point, index) => {
    const dist = Math.hypot(point.x - x, point.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

/** 在"路坐标系"里画东西：+x 沿着路走，+y 横过路 —— 关门、关墙都是这么转着画的 */
function alongRoad(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  draw: () => void,
): void {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  draw();
  g.restore();
}

// ---------------- 景 ----------------

/** 天与地：一条土黄的路从底下一直盘到顶上，两边是远近两道山 */
function drawLand(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FIELD, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  g.fillStyle(FIELD_DEEP, 1);
  g.fillRect(0, H - 30, W, 30);

  // 顶上那一道远山：虢都背后
  for (let i = 0; i < 5; i += 1) {
    const x = 40 + i * 175;
    const top = 172 + ((i * 37) % 40);
    g.fillStyle(HILL_FAR, 1);
    g.fillTriangle(x - 132, 268, x + 132, 268, x, top);
    g.lineStyle(5, shade(HILL_FAR, 0.82), 1);
    g.strokeTriangle(x - 132, 268, x + 132, 268, x, top);
  }
  // 底下那一道：晋营背后
  for (let i = 0; i < 4; i += 1) {
    const x = 90 + i * 200;
    const top = 1204 + ((i * 41) % 50);
    g.fillStyle(HILL_NEAR, 1);
    g.fillTriangle(x - 152, H + 20, x + 152, H + 20, x, top);
    g.lineStyle(5, shade(HILL_NEAR, 0.82), 1);
    g.strokeTriangle(x - 152, H + 20, x + 152, H + 20, x, top);
  }
}

/** 这条路：三段宽窄不一地叠着画，拐弯处用圆点补上接头 */
function drawRoad(g: Phaser.GameObjects.Graphics): void {
  const band = (width: number, color: number, alpha: number): void => {
    g.lineStyle(width, color, alpha);
    for (let i = 0; i + 1 < ROUTE.length; i += 1) {
      g.lineBetween(ROUTE[i]!.x, ROUTE[i]!.y, ROUTE[i + 1]!.x, ROUTE[i + 1]!.y);
    }
    g.fillStyle(color, alpha);
    for (const point of ROUTE) g.fillCircle(point.x, point.y, width / 2);
  };
  band(ROAD_WIDTH + 24, shade(ROAD_COLOR, 0.86), 1);
  band(ROAD_WIDTH, ROAD_COLOR, 1);
  band(ROAD_WIDTH - 46, ROAD_LIGHT, 0.55);

  // 车辙与碎石：一条路看着有年头
  for (let i = 0; i < 12; i += 1) {
    const index = i % (ROUTE.length - 1);
    const from = ROUTE[index]!;
    const to = ROUTE[index + 1]!;
    const p = 0.16 + ((i * 37) % 68) / 100;
    const x = from.x + (to.x - from.x) * p;
    const y = from.y + (to.y - from.y) * p;
    circle(g, x, y, 9, shade(THEME.stone, 0.98), THEME.outline, 4);
  }
}

/** 一处关口的门楼：关墙横过路，门楼架在路上（整座门转着画） */
function drawPassHouse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
): void {
  const half = GATE_RADIUS + 18;
  alongRoad(g, x, y, angle, () => {
    // 关墙：路两侧各一段，各带四个垛口
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? -half - 172 : half;
      roundRect(g, -36, y0, 72, 172, 10, WALL, THEME.outline, 6);
      g.fillStyle(shade(WALL, 1.1), 1);
      for (let i = 0; i < 4; i += 1) g.fillRect(-36, y0 + 20 + i * 42, 72, 16);
      g.lineStyle(5, shade(WALL_DEEP, 1), 0.5);
      g.lineBetween(-28, y0 + 6, -28, y0 + 166);
    }
    // 门楼：架在路上 —— 大军从门楼底下穿过去
    roundRect(g, -48, -half - 18, 96, 2 * half + 36, 12, THEME.redDeep, THEME.outline, 6);
    roundRect(g, -34, -half, 68, 2 * half, 10, shade(THEME.wood, 0.98), THEME.outline, 5);
    g.fillStyle(shade(THEME.inkSoft, 0.72), 0.26);
    g.fillRect(-30, -half + 8, 60, 2 * half - 16);
    // 门楼两头的灯笼
    for (const side of [-1, 1]) circle(g, 0, side * (half + 10), 14, THEME.gold, THEME.outline, 5);
  });
}

/** 一顶帐子：虞君的营帐与营寨里的小帐都用它 */
function drawTent(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s = 1,
  color = TENT,
): void {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  groundShadow(g, 0, 66, 236, 44, 0.16);
  g.fillStyle(color, 1);
  g.fillTriangle(-104, 62, 104, 62, 0, -84);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(-104, 62, 104, 62, 0, -84);
  g.fillStyle(shade(color, 0.7), 1);
  g.fillTriangle(-30, 62, 30, 62, 0, -4);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(-30, 62, 30, 62, 0, -4);
  g.lineStyle(7, THEME.outline, 1);
  g.lineBetween(0, -84, 0, -148);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(0, -148, 54, -130, 0, -112);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(0, -148, 54, -130, 0, -112);
  g.restore();
}

/** 一面插在地上的旗（谁的旗看颜色：青色是我们的，金色是借来的路） */
function drawFlag(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
  const top = y - 108;
  g.lineStyle(7, THEME.outline, 1);
  g.lineBetween(x, y, x, top);
  g.fillStyle(color, 1);
  g.fillTriangle(x, top, x, top + 48, x + 54, top + 24);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x, top, x, top + 48, x + 54, top + 24);
}

/** 自家的营地：出发与回师都在这里（营栅朝着路的一面开着营门） */
function drawCamp(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 82, 268, 52, 0.16);
  roundRect(g, x - 116, y - 78, 232, 160, 26, shade(THEME.sand, 1.02), THEME.outline, 7);
  g.lineStyle(6, shade(THEME.wood, 0.86), 0.5);
  for (let i = 0; i < 6; i += 1) {
    const bx = x - 96 + i * 38;
    g.lineBetween(bx, y - 70, bx, y - 42);
  }
  drawTent(g, x - 52, y + 10, 0.36, shade(TENT, 0.98));
  drawTent(g, x + 48, y + 22, 0.32, shade(TENT, 0.92));
  drawFlag(g, x + 96, y + 62, THEME.teal);
}

/** 虢都上阳：路的尽头（最后一处关口就在它脚下） */
function drawCity(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 64, 300, 52, 0.16);
  roundRect(g, x - 132, y - 40, 264, 110, 16, CITY, THEME.outline, 7);
  g.fillStyle(shade(CITY, 1.1), 1);
  for (let i = 0; i < 7; i += 1) {
    const bx = x - 122 + i * 36;
    g.fillRect(bx, y - 62, 26, 24);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeRect(bx, y - 62, 26, 24);
  }
  // 城门：路从这儿进城
  roundRect(g, x - 40, y + 12, 80, 58, 12, shade(CITY, 0.6), THEME.outline, 6);
  // 城楼
  roundRect(g, x - 32, y - 104, 64, 66, 12, shade(CITY, 1.06), THEME.outline, 6);
  g.fillStyle(shade(CITY, 1.22), 1);
  g.fillTriangle(x - 56, y - 100, x + 56, y - 100, x, y - 144);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 56, y - 100, x + 56, y - 100, x, y - 144);
  drawFlag(g, x + 92, y - 30, THEME.red);
}

/** 路边的几棵松树与石头：空着的地方不至于太空 */
function drawScenery(g: Phaser.GameObjects.Graphics): void {
  for (const [x, y, s] of [
    [68, 620, 1],
    [676, 880, 0.9],
    [668, 1186, 0.8],
    [86, 540, 0.85],
    [620, 300, 0.75],
  ] as const) {
    groundShadow(g, x, y + 8, 62 * s, 18 * s, 0.16);
    g.lineStyle(11 * s, shade(THEME.wood, 0.9), 1);
    g.lineBetween(x, y, x, y - 34 * s);
    for (let i = 0; i < 2; i += 1) {
      const top = y - 118 * s + i * 44 * s;
      g.fillStyle(shade(THEME.leaf, 0.86), 1);
      g.fillTriangle(x - 44 * s, top + 46 * s, x + 44 * s, top + 46 * s, x, top);
      g.lineStyle(5, THEME.outline, 0.7);
      g.strokeTriangle(x - 44 * s, top + 46 * s, x + 44 * s, top + 46 * s, x, top);
    }
  }
}

// ---------------- 世界（画一次） ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: ChainLevel): void {
  drawLand(g);
  drawRoad(g);
  // 三处关口：路从门楼底下穿过
  for (const gate of level.gates) {
    drawPassHouse(g, gate.x, gate.y, routeAngle(routeIndexOf(gate.x, gate.y)));
  }
  // 虞君的营帐：谈借路的地方
  drawTent(g, ENVOY.x - 6, ENVOY.y - 96, 0.88);
  // 虢都上阳：路的尽头
  drawCity(g, CAPITAL.x, CAPITAL.y);
  // 自家的营地
  drawCamp(g, HOME.x, HOME.y - 74);
  drawScenery(g);
}

// ---------------- 大军走到哪儿了 ----------------

interface ColumnView {
  x: number;
  y: number;
  /** 这一段是从第几个路点走到第几个路点（走过的路就按它点亮） */
  from: number;
  to: number;
  angle: number;
  walking: boolean;
  /** 到这一段的目标了没有 */
  arrived: boolean;
}

/** 停在目标前面一点：别站进门楼里头 */
const STAND_OFF = 64;

/**
 * 大军此刻在哪儿 —— 用的是与判定同一份状态：
 * 谈成借路（passAtMs）走第一段，之后每拿下一处关口（lastGateAtMs）走一段。
 */
function columnView(stage: ChainStageState): ColumnView {
  const start = ROUTE[0]!;
  const idle: ColumnView = {
    x: start.x,
    y: start.y,
    from: 0,
    to: 0,
    angle: routeAngle(0),
    walking: false,
    arrived: true,
  };
  // 还没借着路、或者已经回师了：都在自家营里
  if (!stage.pass || stage.home) return idle;

  const from = Math.min(stage.taken.length, GATES.length);
  const to = from + 1;
  const a = ROUTE[from]!;
  const b = ROUTE[to]!;
  const startedAt = from === 0 ? stage.passAtMs : stage.lastGateAtMs;
  const dur = from === 0 ? CHAIN_TIMING.envoyMs : CHAIN_TIMING.gateMs;
  const p = clamp01((stage.elapsedMs - startedAt) / Math.max(1, dur));
  const ease = p * p * (3 - 2 * p);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const travel = Math.max(0, len - STAND_OFF) * ease;
  return {
    x: a.x + (dx / len) * travel,
    y: a.y + (dy / len) * travel,
    from,
    to,
    angle: Math.atan2(dy, dx),
    walking: p < 1,
    arrived: p >= 1,
  };
}

/** 一个小兵（没有兵器，只有旗）：侧着身子朝路的那一头走 */
function drawSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  walking: boolean,
  t: number,
  withBanner: boolean,
): void {
  const bob = walking ? Math.abs(Math.sin(t / 90)) * 5 : Math.sin(t / 460) * 2;
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  groundShadow(g, 0, 4, 74, 20, 0.2);
  if (withBanner) {
    g.lineStyle(7, THEME.outline, 1);
    g.lineBetween(-8, -152 - bob, -8, -48 - bob);
    g.fillStyle(THEME.teal, 1);
    g.fillTriangle(-8, -152 - bob, 46, -134 - bob, -8, -114 - bob);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(-8, -152 - bob, 46, -134 - bob, -8, -114 - bob);
  }
  const stride = walking ? Math.sin(t / 80) * 11 : 0;
  g.lineStyle(11, THEME.inkSoft, 1);
  g.lineBetween(-8, -20, -8 + stride, 0);
  g.lineBetween(8, -20, 8 - stride, 0);
  roundRect(g, -21, -78 - bob, 42, 60, 16, shade(THEME.tealDeep, 1.05), THEME.outline, 5);
  circle(g, 0, -95 - bob, 19, SKIN, THEME.outline, 5);
  circle(g, 0, -110 - bob, 15, THEME.inkSoft, THEME.outline, 4);
  g.restore();
}

/** 一队人：领头的扛着旗，后面跟着两个 */
function drawColumn(g: Phaser.GameObjects.Graphics, view: ColumnView, t: number): void {
  for (let i = 2; i >= 0; i -= 1) {
    const back = i * 58;
    drawSoldier(
      g,
      view.x - Math.cos(view.angle) * back,
      view.y - Math.sin(view.angle) * back,
      view.angle,
      view.walking,
      t + i * 140,
      i === 0,
    );
  }
}

/** 走过的这一段路亮起金光 —— 借来的路，走一步亮一步 */
function drawWalkedRoad(g: Phaser.GameObjects.Graphics, view: ColumnView): void {
  if (view.to === 0) return;
  g.lineStyle(26, THEME.gold, 0.42);
  for (let i = 0; i + 1 <= view.from && i + 1 < ROUTE.length; i += 1) {
    g.lineBetween(ROUTE[i]!.x, ROUTE[i]!.y, ROUTE[i + 1]!.x, ROUTE[i + 1]!.y);
  }
  const tip = view.arrived ? ROUTE[view.to]! : view;
  const head = ROUTE[view.from]!;
  g.lineBetween(head.x, head.y, tip.x, tip.y);
}

// ---------------- 每帧 ----------------

/** 每帧：走过的路、拿下的关口上的旗、借路的令旗、行军的一队人、进度槽 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: ChainStageState,
  level: ChainLevel,
): void {
  const view = columnView(stage);
  drawWalkedRoad(g, view);
  // 拿下的关口：插上我们的旗
  for (const gate of level.gates) {
    if (!stage.taken.includes(gate.id)) continue;
    drawFlag(g, gate.x + 52, gate.y - 26, THEME.teal);
  }
  // 借到路了：虞帐前立起一根金令旗（借来的路）
  if (stage.pass) drawFlag(g, ENVOY.x - 68, ENVOY.y - 50, THEME.gold);
  drawColumn(g, view, stage.elapsedMs);
  chainProgressBar(g, level, stage.takenCount);
}

/** 收尾：整条借来的路都亮起来，回师的箭头一路指回晋营 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: ChainStageState,
  level: ChainLevel,
): void {
  void stage;
  g.fillStyle(THEME.gold, 0.1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  g.lineStyle(34, THEME.gold, 0.42);
  for (let i = 0; i + 1 < ROUTE.length; i += 1) {
    g.lineBetween(ROUTE[i]!.x, ROUTE[i]!.y, ROUTE[i + 1]!.x, ROUTE[i + 1]!.y);
  }
  // 回师的箭头：从最北的上阳关一路指回来
  const tip = ROUTE[0]!;
  const from = ROUTE[1]!;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const size = 62;
  const at = (deg: number): { x: number; y: number } => ({
    x: tip.x + Math.cos(angle + deg) * size,
    y: tip.y + Math.sin(angle + deg) * size,
  });
  const left = at(2.5);
  const right = at(-2.5);
  g.fillStyle(THEME.gold, 0.8);
  g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  for (const gate of level.gates) drawFlag(g, gate.x + 52, gate.y - 26, THEME.teal);
  g.lineStyle(10, THEME.gold, 0.6);
  g.strokeCircle(HOME.x, HOME.y, HOME.radius + 44);
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 使者带着厚礼到虞国借路 ② 借来的路一关一关往北，再从最北折回来 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.99), 1);
  g.fillRoundedRect(x, y + h * 0.66, w, h * 0.34, 30);

  if (index === 0) {
    // ① 两顶帐子隔着一条路：虞公收了礼，把路借出去
    drawTent(g, x + w * 0.2, y + h * 0.66, 0.42, shade(TENT, 1.02));
    drawTent(g, x + w * 0.8, y + h * 0.66, 0.42, shade(TENT, 0.94));
    g.fillStyle(ROAD_COLOR, 1);
    g.fillRect(x + w * 0.4, y + h * 0.42, w * 0.2, h * 0.5);
    g.fillStyle(ROAD_LIGHT, 0.5);
    g.fillRect(x + w * 0.45, y + h * 0.42, w * 0.1, h * 0.5);
    // 路上的礼盒与借路的金令旗
    roundRect(g, x + w * 0.5 - 34, y + h * 0.62, 68, 56, 12, THEME.red, THEME.outline, 6);
    g.lineStyle(6, THEME.gold, 1);
    g.lineBetween(x + w * 0.5 - 34, y + h * 0.62 + 28, x + w * 0.5 + 34, y + h * 0.62 + 28);
    drawFlag(g, x + w * 0.5 + 44, y + h * 0.36, THEME.gold);
    return;
  }

  // ② 借来的路：一关一关往北，最北的箭头折回来
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const points = [
    { x: cx - 150, y: cy + 190 },
    { x: cx + 140, y: cy + 120 },
    { x: cx - 140, y: cy + 20 },
    { x: cx + 140, y: cy - 80 },
    { x: cx - 140, y: cy - 180 },
  ];
  g.lineStyle(58, shade(ROAD_COLOR, 0.88), 1);
  for (let i = 0; i + 1 < points.length; i += 1) {
    g.lineBetween(points[i]!.x, points[i]!.y, points[i + 1]!.x, points[i + 1]!.y);
  }
  g.lineStyle(44, ROAD_COLOR, 1);
  for (let i = 0; i + 1 < points.length; i += 1) {
    g.lineBetween(points[i]!.x, points[i]!.y, points[i + 1]!.x, points[i + 1]!.y);
  }
  // 三处门楼
  for (const point of points.slice(1)) {
    roundRect(g, point.x - 36, point.y - 18, 72, 36, 8, shade(THEME.wood, 0.98), THEME.outline, 5);
    circle(g, point.x, point.y, 9, THEME.gold, THEME.outline, 4);
  }
  // 回师的箭头：从最北那一处折回南边
  g.lineStyle(12, THEME.gold, 0.85);
  g.lineBetween(points[4]!.x, points[4]!.y, points[0]!.x + 60, points[0]!.y + 30);
  const tip = { x: points[0]!.x + 40, y: points[0]!.y + 20 };
  const angle = Math.atan2(tip.y - points[4]!.y, tip.x - points[4]!.x);
  const size = 42;
  const at = (deg: number): { x: number; y: number } => ({
    x: tip.x + Math.cos(angle + deg) * size,
    y: tip.y + Math.sin(angle + deg) * size,
  });
  const left = at(2.5);
  const right = at(-2.5);
  g.fillStyle(THEME.gold, 0.9);
  g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  // 一队人走在路上
  for (let i = 0; i < 3; i += 1) {
    drawSoldier(g, points[1]!.x + i * 34, points[1]!.y - i * 8, -0.6, true, i * 120, i === 0);
  }
}
