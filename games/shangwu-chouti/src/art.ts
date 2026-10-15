import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { SiegeLadderMetrics } from '@chags/templates';
import {
  BAIT, BAR, GROUND_TOP, LADDER_FOOT, LADDER_TOP, PULL, RUNGS, RUNG_RADIUS, SKY_TOP, WALL_TOP,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const MORNING = 0xbcd6e8;
const MORNING_DEEP = 0x8fb4cd;
const EARTH = 0x9c7b52;
const EARTH_DEEP = 0x775c3b;
const WALL = 0xa98a5e;
const WALL_DEEP = 0x846a44;
const GRASS = 0x7fae63;
const SKIN = 0xf8dcbb;
const ZHAO = 0x53607a;
const HAN = 0xd0574a;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (t: number): number => t * t * (3 - 2 * t);

// ---------------- 景 ----------------

/** 晨光：井陉口的山影 */
function drawSky(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(MORNING, 1);
  g.fillRect(0, SKY_TOP, W, WALL_TOP - SKY_TOP);
  g.fillStyle(MORNING_DEEP, 0.55);
  g.fillRect(0, SKY_TOP, W, 90);
  // 远处的山：两道深浅不一的剪影
  g.fillStyle(shade(MORNING_DEEP, 0.82), 1);
  g.fillTriangle(-60, WALL_TOP, 150, 250, 360, WALL_TOP);
  g.fillTriangle(280, WALL_TOP, 520, 300, 760, WALL_TOP);
  g.fillStyle(shade(THEME.stoneDeep, 1.2), 0.7);
  g.fillTriangle(80, WALL_TOP, 250, 330, 420, WALL_TOP);
}

/** 营垒：一道夯土高墙，墙头一道女墙，顶上放着粮囤与帅旗 */
function drawWall(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  // 土墙
  g.fillStyle(WALL_DEEP, 1);
  g.fillRect(0, WALL_TOP, W, GROUND_TOP - WALL_TOP);
  g.fillStyle(WALL, 1);
  g.fillRect(0, WALL_TOP, W, GROUND_TOP - WALL_TOP - 26);
  // 夯土的层理
  for (let i = 0; i < 7; i += 1) {
    const y = WALL_TOP + 40 + i * 62;
    g.lineStyle(4, shade(WALL, 0.9), 0.7);
    g.lineBetween(0, y, W, y + 8);
  }
  // 墙头的步道
  g.fillStyle(shade(WALL_DEEP, 1.15), 1);
  g.fillRect(0, WALL_TOP - 6, W, 26);
  // 女墙（左边一段）
  for (let i = 0; i < 5; i += 1) {
    roundRect(g, 24 + i * 76, WALL_TOP - 62, 56, 58, 10, shade(WALL, 1.02), THEME.outline, 5);
  }
  // 墙脚：草
  g.fillStyle(GRASS, 1);
  g.fillRect(0, GROUND_TOP - 10, W, 34);
  for (let i = 0; i < 16; i += 1) {
    const gx = 20 + i * 46;
    g.fillTriangle(gx, GROUND_TOP + 22, gx + 16, GROUND_TOP - 22, gx + 28, GROUND_TOP + 22);
  }
  // 地面
  g.fillStyle(EARTH, 1);
  g.fillRect(0, GROUND_TOP + 22, W, H - GROUND_TOP - 22);
  g.fillStyle(EARTH_DEEP, 0.4);
  g.fillRect(0, GROUND_TOP + 22, W, 18);

  // 粮囤 + 帅旗（他要去的地方）：抽了梯之后旗下就换成汉军的红旗
  const taken = stage.done;
  drawBait(g, taken);
}

/** 营垒顶上的粮囤与旗（没抽之前是赵军的旗，抽了之后换成汉军的红旗） */
function drawBait(g: Phaser.GameObjects.Graphics, taken: boolean): void {
  const { x, y } = BAIT;
  // 旗杆与旗
  g.lineStyle(9, THEME.outline, 1);
  g.lineBetween(x - 96, 532, x - 96, 300);
  g.fillStyle(taken ? HAN : ZHAO, 1);
  g.fillTriangle(x - 96, 300, x - 96 + (taken ? 132 : 104), 336, x - 96, 372);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 96, 300, x - 96 + (taken ? 132 : 104), 336, x - 96, 372);
  // 粮囤
  roundRect(g, x - 74, y - 36, 148, 148, 34, shade(THEME.sandDeep, 1.02), THEME.outline, 6);
  g.fillStyle(shade(THEME.wood, 0.94), 1);
  g.fillTriangle(x - 92, y - 30, x, y - 130, x + 92, y - 30);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeTriangle(x - 92, y - 30, x, y - 130, x + 92, y - 30);
  g.lineStyle(6, shade(THEME.woodDeep, 1), 1);
  g.lineBetween(x - 74, y + 22, x + 74, y + 22);
  g.lineBetween(x - 74, y + 74, x + 74, y + 74);
}

// ---------------- 梯子 ----------------

/** 一级阶梯该画在哪儿：横杆与梯子的方向垂直（横杆比命中半径长一号） */
function rungBar(x: number, y: number): { x1: number; y1: number; x2: number; y2: number } {
  const dx = LADDER_TOP.x - LADDER_FOOT.x;
  const dy = LADDER_TOP.y - LADDER_FOOT.y;
  const len = Math.hypot(dx, dy) || 1;
  // 垂直方向：横杆伸到命中半径外一号（点得到的地方都画得出来）
  const half = RUNG_RADIUS + 10;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  return { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny };
}

/** 梯子：两根梯梁 + 已经搭上的横杆；没搭的画成淡淡的虚线（抽掉之后墙上就没有梯子了） */
function drawLadderRails(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  if (stage.done) {
    // 梯子已经抽掉了：只剩绳桩与摊在地上的绳头（横躺的梯子在收尾那层画）
    drawRope(g);
    return;
  }
  // 梯梁
  g.lineStyle(18, THEME.woodDeep, 1);
  g.lineBetween(LADDER_FOOT.x, LADDER_FOOT.y, LADDER_TOP.x, LADDER_TOP.y);
  g.lineStyle(6, THEME.outline, 0.6);
  g.lineBetween(LADDER_FOOT.x, LADDER_FOOT.y, LADDER_TOP.x, LADDER_TOP.y);

  for (const rung of RUNGS) {
    const bar = rungBar(rung.x, rung.y);
    const built = stage.built.includes(rung.id);
    if (!built) {
      // 还没搭上：只有一道浅浅的位置
      g.lineStyle(10, THEME.outline, 0.16);
      g.lineBetween(bar.x1, bar.y1, bar.x2, bar.y2);
      continue;
    }
    g.lineStyle(22, THEME.wood, 1);
    g.lineBetween(bar.x1, bar.y1, bar.x2, bar.y2);
    g.lineStyle(7, THEME.outline, 1);
    g.lineBetween(bar.x1, bar.y1, bar.x2, bar.y2);
  }
  drawRope(g);
}

/** 梯脚上拴着的绳子：从梯脚拉到木桩上（抽掉之后就摊在地上） */
function drawRope(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(8, shade(THEME.sandDeep, 0.9), 1);
  g.beginPath();
  g.moveTo(LADDER_FOOT.x, LADDER_FOOT.y - 10);
  g.lineTo(360, 1244);
  g.lineTo(500, 1224);
  g.lineTo(PULL.x - 26, PULL.y - 10);
  g.strokePath();
  // 木桩（点它就是抽梯）
  roundRect(g, PULL.x - 26, PULL.y - 46, 52, 132, 16, THEME.woodDeep, THEME.outline, 6);
  circle(g, PULL.x, PULL.y - 40, 26, shade(THEME.sandDeep, 1), THEME.outline, 6);
}

// ---------------- 往上走的人 ----------------

/** 沿梯子上行到 p（0 = 梯脚，1 = 最高一级） */
function onLadderAt(p: number): { x: number; y: number } {
  const r4 = RUNGS[RUNGS.length - 1]!;
  return {
    x: LADDER_FOOT.x + (r4.x - LADDER_FOOT.x) * p,
    y: LADDER_FOOT.y + (r4.y - LADDER_FOOT.y) * p,
  };
}

/** 他这一刻在哪儿：沿着"梯脚 → 最高一级 → 粮囤"这条线走 */
function climberAt(stage: SiegeLadderMetrics): { x: number; y: number } {
  const r4 = RUNGS[RUNGS.length - 1]!;
  const onWall = clamp01((stage.climbRatio - 0.82) / 0.18);
  if (stage.phase === 'ready' || stage.done) {
    return {
      x: r4.x + (BAIT.x - 74 - r4.x) * onWall,
      y: r4.y + (BAIT.y + 96 - r4.y) * onWall,
    };
  }
  // 掉回来的那一下：从掉下去的位置一路滑回地面（900 毫秒，之后他就站在梯脚等着）
  const falling = stage.droppedAtMs >= 0 && stage.elapsedMs - stage.droppedAtMs < 900;
  if (falling) {
    const fall = ease(clamp01((stage.elapsedMs - stage.droppedAtMs) / 900));
    return onLadderAt(ease(clamp01(stage.droppedFromRatio / 0.82)) * (1 - fall));
  }
  return onLadderAt(ease(clamp01(stage.climbRatio / 0.82)));
}

/** 顺着梯子往上走的赵将：抱着旗、一步一步往上挪 */
function drawClimber(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  const spot = climberAt(stage);
  // 掉回来的那一下：地上扬一圈土
  if (stage.droppedAtMs >= 0 && stage.elapsedMs - stage.droppedAtMs < 700) {
    const puff = clamp01(1 - (stage.elapsedMs - stage.droppedAtMs) / 700);
    g.fillStyle(shade(THEME.sand, 0.9), 0.5 * puff);
    g.fillCircle(LADDER_FOOT.x, LADDER_FOOT.y + 10, 70 + 60 * (1 - puff));
  }
  groundShadow(g, spot.x, spot.y + 62, 96, 26, 0.24);
  g.lineStyle(16, THEME.outline, 1);
  g.lineBetween(spot.x - 14, spot.y + 34, spot.x - 20, spot.y + 62);
  g.lineBetween(spot.x + 14, spot.y + 34, spot.x + 20, spot.y + 62);
  roundRect(g, spot.x - 38, spot.y - 52, 76, 96, 24, ZHAO, THEME.outline, 6);
  circle(g, spot.x, spot.y - 78, 30, SKIN, THEME.outline, 6);
  roundRect(g, spot.x - 34, spot.y - 112, 68, 28, 12, shade(ZHAO, 0.8), THEME.outline, 5);
  // 他手里那面赵军的旗
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(spot.x + 40, spot.y - 6, spot.x + 40, spot.y - 128);
  g.fillStyle(ZHAO, 1);
  g.fillTriangle(spot.x + 40, spot.y - 128, spot.x + 108, spot.y - 102, spot.x + 40, spot.y - 76);
  if (stage.phase === 'ready') {
    // 到位了：头顶冒一圈金光，提示"该抽梯了"
    g.lineStyle(8, THEME.gold, 0.7);
    g.strokeCircle(spot.x, spot.y - 78, 56);
  }
}

// ---------------- 进度 ----------------

/** 底下那条小进度条：四级阶梯搭到几级了 */
function drawBar(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  roundRect(g, BAR.x, BAR.y, BAR.w, BAR.h, BAR.h / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  const span = Math.max(1, stage.total - 1);
  for (let i = 0; i < stage.total; i += 1) {
    const bx = BAR.x + 46 + i * ((BAR.w - 92) / span);
    const rung = RUNGS[i];
    const built = rung !== undefined && stage.built.includes(rung.id);
    roundRect(
      g,
      bx - 22,
      BAR.y + 6,
      44,
      BAR.h - 12,
      10,
      built ? THEME.gold : shade(THEME.sand, 0.9),
      THEME.outline,
      5,
    );
  }
}

// ---------------- 每帧 ----------------

/** 每帧：晨光、营垒、梯子、往上走的赵将、底下的进度 */
export function drawLadder(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  drawSky(g);
  drawWall(g, stage);
  drawLadderRails(g, stage);
  drawClimber(g, stage);
  drawBar(g, stage);
}

/** 成了：梯子抽了，他下不来 —— 墙头换上汉军的红旗 */
export function drawLadderFinale(g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics): void {
  g.fillStyle(THEME.gold, 0.12);
  g.fillCircle(BAIT.x, BAIT.y + 40, 300);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(BAIT.x, BAIT.y + 40, 250);
  // 抽掉的梯子：横躺在地上
  g.lineStyle(18, THEME.wood, 1);
  g.lineBetween(150, 1246, 470, 1258);
  g.lineStyle(14, THEME.wood, 1);
  for (let i = 0; i < 4; i += 1) {
    g.lineBetween(190 + i * 82, 1218, 200 + i * 82, 1288);
  }
  g.lineStyle(7, THEME.outline, 0.7);
  g.lineBetween(150, 1246, 470, 1258);
  void stage;
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 背水列阵 ② 营垒上换上红旗、梯子横在地上 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(MORNING, 1);
  g.fillRoundedRect(x, y, w, h * 0.5, 30);
  g.fillStyle(shade(EARTH, 1.05), 1);
  g.fillRoundedRect(x, y + h * 0.5, w, h * 0.5, 30);

  if (index === 0) {
    // ① 背水列阵：一排人在水边，身后就是河
    g.fillStyle(THEME.water, 1);
    g.fillRect(x, y + h * 0.72, w, h * 0.28);
    g.fillStyle(THEME.waterDeep, 0.6);
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(x + 20, y + h * 0.78 + i * 22, w - 40, 8);
    }
    for (let i = 0; i < 4; i += 1) {
      const sx = x + w * 0.22 + i * w * 0.18;
      const sy = y + h * 0.66;
      roundRect(g, sx - 20, sy - 46, 40, 58, 14, ZHAO, THEME.outline, 5);
      circle(g, sx, sy - 62, 17, SKIN, THEME.outline, 5);
      g.lineStyle(5, THEME.outline, 1);
      g.lineBetween(sx + 22, sy - 40, sx + 22, sy - 110);
      g.fillStyle(HAN, 1);
      g.fillTriangle(sx + 22, sy - 110, sx + 62, sy - 94, sx + 22, sy - 78);
    }
    return;
  }

  // ② 营垒上换上了红旗，梯子横躺在地上
  const wallTop = y + h * 0.5;
  g.fillStyle(WALL, 1);
  g.fillRect(x + w * 0.18, wallTop, w * 0.72, h * 0.34);
  g.fillStyle(shade(WALL_DEEP, 1.1), 1);
  g.fillRect(x + w * 0.18, wallTop - 10, w * 0.72, 16);
  for (let i = 0; i < 3; i += 1) {
    const fx = x + w * 0.3 + i * w * 0.2;
    g.lineStyle(6, THEME.outline, 1);
    g.lineBetween(fx, wallTop, fx, wallTop - 104);
    g.fillStyle(HAN, 1);
    g.fillTriangle(fx, wallTop - 104, fx + 62, wallTop - 84, fx, wallTop - 64);
  }
  g.lineStyle(16, THEME.wood, 1);
  g.lineBetween(x + w * 0.12, wallTop + h * 0.22, x + w * 0.52, wallTop + h * 0.3);
}
