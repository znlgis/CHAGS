import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { CHAIN_STEP, chainStepBar, chainStepGrantBar } from '@chags/templates/chain';
import type { ChainStepMetrics } from '@chags/templates';
import type { ChainStepLevel } from '@chags/templates/schemas';
import { DESIGN_H, DESIGN_W, GRANT, POST_RADIUS, POSTS, RIDGES, ROAD_WIDTH, ROUTE, SKY_TOP } from './layout';
import { clamp01 } from '@chags/game-kit';

/**
 * 第 30 计的这一屏：**没有一场交战**。
 *
 * 一条蜀道从南往北盘上去：南边是刘璋的营帐（要在这里求一个"允许"），
 * 往北依次是涪城营帐、葭萌关、雒城，最后是成都。
 * 队伍一处一处往北走：求到允许 → 把这一处的活儿接下来 → 再求下一次。
 * 接手的每一处都插上我们的旗 —— **一步一步来，急不得**。
 */

const SKIN = 0xf8dcbb;
const FIELD = 0xe9dfbc;
const FIELD_DEEP = 0xd6c79c;
const HILL_FAR = 0xa9c0ae;
const HILL_NEAR = 0x8fb096;
const ROAD = 0xcaa977;
const ROAD_LIGHT = 0xdfc497;
const TENT = 0xd9b46a;
const WALL = 0xb3a68d;
const WALL_DEEP = 0x8e8270;
const CITY = 0xd0a06a;


// ---------------- 路 ----------------

/** 这是路点里的第几个（岗位就落在路点上） */
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

/** 路点在这一点的走向 */
function routeAngle(index: number): number {
  const from = ROUTE[Math.max(0, index - 1)]!;
  const to = ROUTE[Math.min(ROUTE.length - 1, index + 1)]!;
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// ---------------- 景 ----------------

/** 山、路与两侧的松树：一条蜀道从南盘到北 */
function drawLand(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FIELD, 1);
  g.fillRect(0, SKY_TOP, DESIGN_W, DESIGN_H - SKY_TOP);
  g.fillStyle(FIELD_DEEP, 1);
  g.fillRect(0, DESIGN_H - 34, DESIGN_W, 34);

  // 最北边的一道远山：成都背后的山影
  for (let i = 0; i < 5; i += 1) {
    const x = 40 + i * 176;
    const top = 176 + ((i * 37) % 36);
    g.fillStyle(HILL_FAR, 1);
    g.fillTriangle(x - 130, 288, x + 130, 288, x, top);
    g.lineStyle(5, shade(HILL_FAR, 0.82), 1);
    g.strokeTriangle(x - 130, 288, x + 130, 288, x, top);
  }
  // 两边层叠的山脊：蜀道就在这些山之间
  for (const ridge of RIDGES) {
    const x = ridge.x;
    const y = ridge.y;
    const s = ridge.s;
    g.fillStyle(HILL_NEAR, 1);
    g.fillTriangle(x - 180 * s, y + 150 * s, x + 180 * s, y + 150 * s, x, y - 150 * s);
    g.lineStyle(5, shade(HILL_NEAR, 0.82), 1);
    g.strokeTriangle(x - 180 * s, y + 150 * s, x + 180 * s, y + 150 * s, x, y - 150 * s);
  }
}

/** 这条路：三段宽窄不一的带子叠着画，拐弯处用圆点补上接头 */
function drawRoad(g: Phaser.GameObjects.Graphics): void {
  const band = (width: number, color: number, alpha: number): void => {
    g.lineStyle(width, color, alpha);
    for (let i = 0; i + 1 < ROUTE.length; i += 1) {
      g.lineBetween(ROUTE[i]!.x, ROUTE[i]!.y, ROUTE[i + 1]!.x, ROUTE[i + 1]!.y);
    }
    g.fillStyle(color, alpha);
    for (const point of ROUTE) g.fillCircle(point.x, point.y, width / 2);
  };
  band(ROAD_WIDTH + 22, shade(ROAD, 0.86), 1);
  band(ROAD_WIDTH, ROAD, 1);
  band(ROAD_WIDTH - 42, ROAD_LIGHT, 0.5);
  for (let i = 0; i < 10; i += 1) {
    const index = i % (ROUTE.length - 1);
    const from = ROUTE[index]!;
    const to = ROUTE[index + 1]!;
    const p = 0.18 + ((i * 41) % 64) / 100;
    circle(g, from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p, 8, shade(THEME.stone, 1), THEME.outline, 4);
  }
}

/** 一顶帐子（刘璋的营帐与涪城的营帐都用它） */
function drawTent(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1, color = TENT): void {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  groundShadow(g, 0, 62, 226, 42, 0.16);
  g.fillStyle(color, 1);
  g.fillTriangle(-100, 58, 100, 58, 0, -80);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(-100, 58, 100, 58, 0, -80);
  g.fillStyle(shade(color, 0.7), 1);
  g.fillTriangle(-28, 58, 28, 58, 0, -6);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(-28, 58, 28, 58, 0, -6);
  g.lineStyle(7, THEME.outline, 1);
  g.lineBetween(0, -80, 0, -142);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(0, -142, 52, -126, 0, -108);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(0, -142, 52, -126, 0, -108);
  g.restore();
}

/** 一处关隘的门楼（葭萌关） */
function drawPass(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number): void {
  const half = POST_RADIUS + 20;
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  groundShadow(g, 0, half + 24, 260, 40, 0.16);
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? -half - 168 : half;
    roundRect(g, -34, y0, 68, 168, 10, WALL, THEME.outline, 6);
    g.fillStyle(shade(WALL, 1.1), 1);
    for (let i = 0; i < 4; i += 1) g.fillRect(-34, y0 + 18 + i * 40, 68, 15);
    g.lineStyle(5, shade(WALL_DEEP, 1), 0.5);
    g.lineBetween(-26, y0 + 6, -26, y0 + 162);
  }
  roundRect(g, -46, -half - 18, 92, 2 * half + 36, 12, THEME.redDeep, THEME.outline, 6);
  roundRect(g, -32, -half, 64, 2 * half, 10, shade(THEME.wood, 0.98), THEME.outline, 5);
  for (const side of [-1, 1]) circle(g, 0, side * (half + 10), 13, THEME.gold, THEME.outline, 5);
  g.restore();
}

/** 一座城（雒城与成都）：城门朝着路，就是"接下来"的地方 */
function drawCity(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  groundShadow(g, 0, 66, 300, 50, 0.16);
  roundRect(g, -130, -38, 260, 106, 16, CITY, THEME.outline, 7);
  g.fillStyle(shade(CITY, 1.1), 1);
  for (let i = 0; i < 7; i += 1) {
    const bx = -120 + i * 35;
    g.fillRect(bx, -60, 25, 23);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeRect(bx, -60, 25, 23);
  }
  roundRect(g, -38, 12, 76, 56, 12, shade(CITY, 0.6), THEME.outline, 6);
  roundRect(g, -30, -102, 60, 64, 12, shade(CITY, 1.06), THEME.outline, 6);
  g.fillStyle(shade(CITY, 1.2), 1);
  g.fillTriangle(-52, -98, 52, -98, 0, -140);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(-52, -98, 52, -98, 0, -140);
  g.restore();
}

/** 一面旗（谁的旗看颜色：青色是我们的） */
function drawFlag(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, s = 1): void {
  const top = y - 104 * s;
  g.lineStyle(7 * s, THEME.outline, 1);
  g.lineBetween(x, y, x, top);
  g.fillStyle(color, 1);
  g.fillTriangle(x, top, x, top + 52 * s, x + 56 * s, top + 26 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x, top, x, top + 52 * s, x + 56 * s, top + 26 * s);
}

export function drawWorld(g: Phaser.GameObjects.Graphics, level: ChainStepLevel): void {
  drawLand(g);
  drawRoad(g);
  // 求允许的地方：刘璋的营帐（关卡数据里的 grant 必须落在这儿）
  drawTent(g, GRANT.x + 8, GRANT.y - 92, 0.9);
  drawFlag(g, GRANT.x - 62, GRANT.y + 34, THEME.red);
  // 沿途四处岗位：营帐 / 关隘 / 城 / 城
  for (const post of level.posts) {
    const spot = POSTS.find((item) => item.id === post.id);
    if (spot === undefined) continue;
    const index = routeIndexOf(spot.x, spot.y);
    if (post.id === 'fu-camp') {
      drawTent(g, spot.x, spot.y - 74, 0.82, shade(TENT, 0.96));
      continue;
    }
    if (post.id === 'jiameng-pass') {
      drawPass(g, spot.x, spot.y, routeAngle(index));
      continue;
    }
    drawCity(g, spot.x, spot.y, post.id === 'chengdu' ? 1.08 : 0.94);
  }
}

// ---------------- 队伍走到哪儿了 ----------------

/** 队伍此刻在哪儿：接下一处就往前走一小段（接完最后一处就到成都） */
function columnAt(stage: ChainStepMetrics): { x: number; y: number; angle: number; walking: boolean } {
  const from = Math.min(stage.takenCount, ROUTE.length - 1);
  const to = Math.min(from + 1, ROUTE.length - 1);
  const a = ROUTE[from]!;
  const b = ROUTE[to]!;
  const p = stage.lastPostAtMs < 0 ? 0 : clamp01((stage.elapsedMs - stage.lastPostAtMs) / CHAIN_STEP.takeoverMs);
  const travel = p * 0.45;
  const ease = travel * travel * (3 - 2 * travel);
  return {
    x: a.x + (b.x - a.x) * ease,
    y: a.y + (b.y - a.y) * ease,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    walking: travel > 0 && travel < 0.45,
  };
}

/** 队里的一个人（没有兵器，只有旗） */
function drawSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  walking: boolean,
  t: number,
  withFlag: boolean,
): void {
  const bob = walking ? Math.abs(Math.sin(t / 90)) * 5 : Math.sin(t / 460) * 2;
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  groundShadow(g, 0, 4, 74, 20, 0.2);
  if (withFlag) drawFlag(g, -6, -52 - bob, THEME.teal, 0.92);
  const stride = walking ? Math.sin(t / 80) * 10 : 0;
  g.lineStyle(11, THEME.inkSoft, 1);
  g.lineBetween(-8, -20, -8 + stride, 0);
  g.lineBetween(8, -20, 8 - stride, 0);
  roundRect(g, -21, -78 - bob, 42, 60, 16, shade(THEME.tealDeep, 1.05), THEME.outline, 5);
  circle(g, 0, -95 - bob, 19, SKIN, THEME.outline, 5);
  circle(g, 0, -110 - bob, 15, THEME.inkSoft, THEME.outline, 4);
  g.restore();
}

// ---------------- 每帧 ----------------

/** 每帧：拿下的岗位插旗、队伍走在路上、允许的沙漏、进度槽 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: ChainStepMetrics,
  level: ChainStepLevel,
): void {
  const t = stage.elapsedMs;
  // 接手的岗位：插上我们的旗
  for (const post of level.posts) {
    if (!stage.taken.includes(post.id)) continue;
    drawFlag(g, post.x + 54, post.y - 22, THEME.teal);
  }
  // 接下来该接手的那一处：外圈呼吸（还没求允许时它也亮着，等着）
  if (stage.nextPost) {
    const p = (Math.sin(t / 420) + 1) / 2;
    g.lineStyle(7, THEME.gold, 0.32 + 0.3 * p);
    g.strokeCircle(stage.nextPost.x, stage.nextPost.y, stage.nextPost.radius + 12 + 8 * p);
  }
  // 求允许的地方：允许还剩多久，营帐上那圈光就多大
  const granted = stage.grantMs <= 0 ? 0 : stage.grantLeftMs / stage.grantMs;
  g.lineStyle(8, THEME.gold, 0.22 + 0.5 * clamp01(granted));
  g.strokeCircle(GRANT.x, GRANT.y, GRANT.radius + 16);
  if (stage.granted) {
    g.fillStyle(THEME.gold, 0.18);
    g.fillCircle(GRANT.x, GRANT.y, GRANT.radius * (0.6 + 0.4 * clamp01(granted)));
  }
  // 队伍
  const column = columnAt(stage);
  for (let i = 2; i >= 0; i -= 1) {
    const back = i * 54;
    drawSoldier(
      g,
      column.x - Math.cos(column.angle) * back,
      column.y - Math.sin(column.angle) * back,
      column.angle,
      column.walking,
      t + i * 140,
      i === 0,
    );
  }
  chainStepBar(g, level, stage.takenCount);
  chainStepGrantBar(g, level, stage.grantLeftMs);
}

/** 收尾：整条蜀道亮起来，四处岗位都插着我们的旗 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: ChainStepMetrics,
  level: ChainStepLevel,
): void {
  void stage;
  g.fillStyle(THEME.gold, 0.1);
  g.fillRect(0, SKY_TOP, DESIGN_W, DESIGN_H - SKY_TOP);
  g.lineStyle(30, THEME.gold, 0.4);
  for (let i = 0; i + 1 < ROUTE.length; i += 1) {
    g.lineBetween(ROUTE[i]!.x, ROUTE[i]!.y, ROUTE[i + 1]!.x, ROUTE[i + 1]!.y);
  }
  for (const post of level.posts) drawFlag(g, post.x + 54, post.y - 22, THEME.teal);
  g.lineStyle(10, THEME.gold, 0.6);
  g.strokeCircle(GRANT.x, GRANT.y, GRANT.radius + 42);
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 刘璋请刘备入蜀 ② 一处一处接下来，最后走到成都 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(FIELD, 1);
  g.fillRoundedRect(x, y + h * 0.56, w, h * 0.44, 30);

  if (index === 0) {
    // ① 两顶帐子隔着一条路：刘璋请刘备来帮忙
    drawTent(g, x + w * 0.22, y + h * 0.72, 0.46, shade(TENT, 1.02));
    drawTent(g, x + w * 0.78, y + h * 0.72, 0.46, shade(TENT, 0.94));
    g.fillStyle(ROAD, 1);
    g.fillRect(x + w * 0.42, y + h * 0.46, w * 0.16, h * 0.5);
    g.fillStyle(ROAD_LIGHT, 0.5);
    g.fillRect(x + w * 0.46, y + h * 0.46, w * 0.08, h * 0.5);
    // 路上摆着请客的礼物
    roundRect(g, x + w * 0.5 - 32, y + h * 0.64, 64, 52, 12, THEME.red, THEME.outline, 6);
    drawFlag(g, x + w * 0.5 + 42, y + h * 0.4, THEME.red, 0.9);
    return;
  }

  // ② 蜀道上四处岗位：一处亮一处，一路亮到最北的成都
  const points = [
    { x: x + w * 0.24, y: y + h * 0.86 },
    { x: x + w * 0.62, y: y + h * 0.7 },
    { x: x + w * 0.3, y: y + h * 0.5 },
    { x: x + w * 0.64, y: y + h * 0.32 },
  ];
  g.lineStyle(40, shade(ROAD, 0.9), 1);
  for (let i = 0; i + 1 < points.length; i += 1) {
    g.lineBetween(points[i]!.x, points[i]!.y, points[i + 1]!.x, points[i + 1]!.y);
  }
  g.lineStyle(30, ROAD, 1);
  for (let i = 0; i + 1 < points.length; i += 1) {
    g.lineBetween(points[i]!.x, points[i]!.y, points[i + 1]!.x, points[i + 1]!.y);
  }
  points.forEach((point, i) => {
    if (i === points.length - 1) drawCity(g, point.x, point.y, 0.5);
    else roundRect(g, point.x - 34, point.y - 20, 68, 40, 10, shade(THEME.wood, 0.98), THEME.outline, 5);
    drawFlag(g, point.x + 30, point.y - 4, THEME.teal, 0.7);
  });
}
