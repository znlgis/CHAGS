import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import type { TraceLevel, TraceStageMetrics } from '@chags/templates';
import {
  ALLY_FLAGS, DESIGN_H, DESIGN_W, HOME_CAMP, POST_OFFSET, SAFE_CAMP, SHES, SKY_TOP,
} from './layout';
import { retreatStops } from './logic';

const FIELD = 0xbfe3a4;
const FIELD_DEEP = 0xa9d691;
const SOIL = 0xb08748;
const DUST = 0xd8c39a;
const STONE = 0xded3ba;
const STONE_DEEP = 0xbdb096;
const SKIN = 0xf6d3ae;
const HAIR = 0x3a2f26;
const GATE = 0x8a5a2c;

/** 手指划出来的那条退路长什么样：一条踩出来的土路（不是河道） */
export const ROAD_STROKE = { outer: 0x9c7a3c, inner: 0xf3e3bd, width: 44 } as const;

// ---------- 通用画笔 ----------

function sun(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.lineStyle(6, THEME.goldDeep, 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(
      x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8),
      x + Math.cos(a) * (r + 26), y + Math.sin(a) * (r + 26),
    );
  }
  circle(g, x, y, r, THEME.gold, THEME.goldDeep, 6);
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(THEME.card, 0.95);
  g.fillCircle(x, y, 30 * s);
  g.fillCircle(x + 38 * s, y - 14 * s, 38 * s);
  g.fillCircle(x + 78 * s, y + 2 * s, 26 * s);
  g.fillRoundedRect(x - 20 * s, y + 2 * s, 110 * s, 28 * s, 14 * s);
}

/** 北边的山影：追兵就是从那个方向来的 */
function hill(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, rx: number, ry: number, color: number): void {
  const pts: Array<[number, number]> = [];
  const steps = 20;
  for (let i = 0; i <= steps; i += 1) {
    const a = Math.PI * (i / steps);
    pts.push([cx - Math.cos(a) * rx, baseY - Math.sin(a) * ry]);
  }
  g.fillStyle(color, 1);
  g.beginPath();
  pts.forEach(([px, py], index) => {
    if (index === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
}

/** 一丛草：大平原上一路都是它 */
function tuft(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.lineStyle(5 * s, shade(FIELD_DEEP, 0.86), 1);
  g.lineBetween(x, y, x - 12 * s, y - 22 * s);
  g.lineBetween(x + 6 * s, y, x + 4 * s, y - 26 * s);
  g.lineBetween(x + 12 * s, y, x + 22 * s, y - 18 * s);
}

/** 追兵扬起的尘土：不画刀枪，只画烟与旗号 */
function dustCloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha: number): void {
  g.fillStyle(DUST, alpha);
  g.fillCircle(x, y, 46 * s);
  g.fillCircle(x - 58 * s, y + 14 * s, 34 * s);
  g.fillCircle(x + 60 * s, y + 8 * s, 40 * s);
  g.fillCircle(x + 20 * s, y - 30 * s, 32 * s);
  g.fillStyle(shade(DUST, 1.08), alpha * 0.9);
  g.fillCircle(x - 22 * s, y - 10 * s, 24 * s);
}

/** 一面旗：谁家的旗，看颜色 */
function flag(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number): void {
  g.lineStyle(7 * s, THEME.woodDeep, 1);
  g.lineBetween(x, y, x, y - 92 * s);
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x, y - 92 * s);
  g.lineTo(x + 62 * s, y - 72 * s);
  g.lineTo(x, y - 50 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokePath();
}

/** 晋军的人：披着袍子，一步一步往南走（phase 是走路的相位） */
function soldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  robe: number,
  phase: number,
): void {
  const swing = Math.sin(phase * Math.PI * 2) * 12 * s;
  groundShadow(g, x, y + 4 * s, 52 * s, 14 * s);
  g.lineStyle(10 * s, shade(robe, 0.72), 1);
  g.lineBetween(x - 8 * s, y - 32 * s, x - 8 * s + swing, y);
  g.lineBetween(x + 8 * s, y - 32 * s, x + 8 * s - swing, y);
  roundRect(g, x - 22 * s, y - 98 * s, 44 * s, 70 * s, 18 * s, robe, THEME.outline, 5 * s);
  circle(g, x, y - 116 * s, 22 * s, SKIN, THEME.outline, 5 * s);
  g.fillStyle(HAIR, 1);
  g.fillRoundedRect(x - 23 * s, y - 140 * s, 46 * s, 24 * s, 10 * s);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 7 * s, y - 118 * s, 3.4 * s);
  g.fillCircle(x + 7 * s, y - 118 * s, 3.4 * s);
  g.lineStyle(4 * s, THEME.outline, 1);
  g.lineBetween(x - 7 * s, y - 104 * s, x + 7 * s, y - 104 * s);
}

/** 辎重车：人退，东西也跟着退 —— "保住人和东西"不是一句话，是这辆车 */
function cart(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  groundShadow(g, x, y + 6 * s, 150 * s, 22 * s);
  for (const dx of [-40, 40] as const) {
    g.fillStyle(THEME.woodDeep, 1);
    g.fillCircle(x + dx * s, y - 2 * s, 26 * s);
    g.lineStyle(5 * s, THEME.outline, 1);
    g.strokeCircle(x + dx * s, y - 2 * s, 26 * s);
    g.lineStyle(4 * s, THEME.outline, 0.8);
    g.strokeCircle(x + dx * s, y - 2 * s, 12 * s);
  }
  roundRect(g, x - 74 * s, y - 74 * s, 148 * s, 52 * s, 12 * s, THEME.wood, THEME.outline, 5 * s);
  // 车上的粮袋
  g.fillStyle(0xdcb46f, 1);
  g.fillEllipse(x - 34 * s, y - 84 * s, 52 * s, 40 * s);
  g.fillEllipse(x + 30 * s, y - 82 * s, 48 * s, 38 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeEllipse(x - 34 * s, y - 84 * s, 52 * s, 40 * s);
  g.strokeEllipse(x + 30 * s, y - 82 * s, 48 * s, 38 * s);
  // 车辕
  g.lineStyle(8 * s, THEME.woodDeep, 1);
  g.lineBetween(x + 74 * s, y - 56 * s, x + 132 * s, y - 30 * s);
}

/** 一块里程碑：一舍三十里，走过了就刻一道痕 */
function post(g: Phaser.GameObjects.Graphics, x: number, y: number, notches: number): void {
  groundShadow(g, x, y + 4, 54, 16);
  roundRect(g, x - 15, y - 112, 30, 118, 10, THEME.wood, THEME.outline, 5);
  roundRect(g, x - 40, y - 140, 80, 40, 12, THEME.woodDeep, THEME.outline, 5);
  if (notches <= 0) return;
  g.lineStyle(6, THEME.card, 1);
  for (let i = 0; i < notches; i += 1) {
    const cy = y - 122 + i * 13;
    g.lineBetween(x - 14, cy, x + 14, cy - 4);
  }
}

/** 城门画多大：门洞两边各留这么多 */
const GATE_HALF = 62;

/** 一扇城门：关着的时候是两片木门，开门时往两边让开 */
function gateAt(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  top: number,
  bottom: number,
  half: number,
  opened: number,
): void {
  // 门洞：夜里也不黑，看得见里面的光
  g.fillStyle(0x6b5230, 1);
  g.fillRect(cx - half, top, half * 2, bottom - top);
  const swing = Math.max(0, Math.min(1, opened)) * (half - 8);
  if (swing < half - 10) {
    const panel = half - swing;
    roundRect(g, cx - half, top, panel, bottom - top, { tl: 0, tr: 0, bl: 0, br: 0 }, GATE, THEME.outline, 5);
    roundRect(g, cx + half - panel, top, panel, bottom - top, { tl: 0, tr: 0, bl: 0, br: 0 }, GATE, THEME.outline, 5);
  }
  if (opened > 0) {
    g.fillStyle(THEME.gold, 0.28 * opened);
    g.fillRect(cx - half + 6, top + 6, half * 2 - 12, bottom - top - 12);
  }
}

/** 城濮的城门：门洞开在城墙正中，最后一段的落脚点就在门里 */
function gateDoor(g: Phaser.GameObjects.Graphics, opened: number): void {
  gateAt(g, SAFE_CAMP.x, 992, 1132, GATE_HALF, opened);
}

// ---------- 世界（画一次） ----------

/** 大平原与城濮的城墙：这一段是静的，每帧只重画人、尘土与路标 */
export function drawWorld(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(1);

  // 天
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, DESIGN_W, 400 - SKY_TOP);
  sun(g, 622, 236, 40);
  cloud(g, 138, 244, 0.9);
  cloud(g, 468, 312, 0.6);
  // 北边的山影
  hill(g, 110, 430, 230, 140, 0xa8cdb4);
  hill(g, 640, 430, 260, 116, 0x9ec7ad);

  // 平原
  g.fillStyle(FIELD, 1);
  g.fillRect(0, 388, DESIGN_W, DESIGN_H - 388);
  g.fillStyle(FIELD_DEEP, 0.5);
  g.fillRect(0, 388, DESIGN_W, 26);
  for (let i = 0; i < 14; i += 1) {
    const x = 40 + (i * 137) % 700;
    const y = 470 + ((i * 213) % 480);
    tuft(g, x, y, i % 3 === 0 ? 1.1 : 0.8);
  }

  // 踩出来的那条土路：从北边的营地一直通到城濮城门
  g.lineStyle(52, shade(SOIL, 0.9), 0.55);
  g.lineBetween(HOME_CAMP.x, HOME_CAMP.y + 40, SAFE_CAMP.x, SAFE_CAMP.y - 20);
  g.lineStyle(30, shade(SOIL, 1.12), 0.5);
  g.lineBetween(HOME_CAMP.x, HOME_CAMP.y + 40, SAFE_CAMP.x, SAFE_CAMP.y - 20);

  // 晋军出发的营地：两顶帐篷，一面旗
  for (const [dx, s] of [[-96, 0.86], [0, 1]] as const) {
    const x = HOME_CAMP.x + dx;
    const y = HOME_CAMP.y + (dx === 0 ? 0 : 26);
    groundShadow(g, x, y + 6 * s, 132 * s, 22 * s);
    g.fillStyle(0xf0dcb4, 1);
    g.beginPath();
    g.moveTo(x - 58 * s, y);
    g.lineTo(x, y - 96 * s);
    g.lineTo(x + 58 * s, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(5 * s, THEME.outline, 1);
    g.strokePath();
  }
  flag(g, HOME_CAMP.x + 104, HOME_CAMP.y + 20, 0.9, THEME.gold);

  // 城濮：一道城墙横在南边，中间留着城门（门洞 313..437，正好容下"城门"那个落脚点）
  const wallTop = 992;
  const wallH = DESIGN_H - wallTop + 40;
  g.fillStyle(STONE, 1);
  g.fillRect(-40, wallTop, SAFE_CAMP.x - GATE_HALF + 40, wallH);
  g.fillRect(SAFE_CAMP.x + GATE_HALF, wallTop, DESIGN_W - SAFE_CAMP.x - GATE_HALF + 40, wallH);
  g.fillStyle(STONE_DEEP, 1);
  for (let x = -30; x < SAFE_CAMP.x - GATE_HALF - 34; x += 62) g.fillRect(x, wallTop - 34, 42, 40);
  for (let x = SAFE_CAMP.x + GATE_HALF + 11; x < DESIGN_W + 30; x += 62) g.fillRect(x, wallTop - 34, 42, 40);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRect(-40, wallTop, SAFE_CAMP.x - GATE_HALF + 40, wallH);
  g.strokeRect(SAFE_CAMP.x + GATE_HALF, wallTop, DESIGN_W - SAFE_CAMP.x - GATE_HALF + 40, wallH);
  // 门框
  roundRect(g, SAFE_CAMP.x - GATE_HALF - 16, wallTop - 14, GATE_HALF * 2 + 32, 30, 10, STONE_DEEP, THEME.outline, 6);
}

// ---------- 每帧重画：人、尘土与路标 ----------

/**
 * 每帧重画：晋军（连辎重车）就在手指划到的地方，尘土永远在北边追，
 * 走过的里程碑刻上刻痕 —— 退满三舍，城门就开。
 */
export function drawRetreatStage(
  g: Phaser.GameObjects.Graphics,
  stage: TraceStageMetrics,
  level: TraceLevel,
  state: { marched: number; now: number },
): void {
  const index = Math.min(stage.segment, Math.max(0, level.segments.length - 1));
  const segment = level.segments[index];
  const head = stage.path.length > 0 ? stage.path[stage.path.length - 1]! : segment?.start ?? SAFE_CAMP;
  const phase = (state.now / 260) % 1;
  const done = state.marched >= level.segments.length;

  // 追兵：不画刀枪，只画追到哪儿 —— 尘土始终在晋军的北边
  dustCloud(g, head.x - 66, head.y - 158, 1, 0.8);
  dustCloud(g, head.x + 74, head.y - 196, 0.78, 0.62);

  // 里程碑：走过一块，刻痕就刻上去（第三舍就是城濮的城门，不另画木桩）
  SHES.forEach((she, i) => {
    if (i >= level.segments.length - 1) return;
    post(g, she.x + POST_OFFSET, she.y, state.marched > i ? she.notches : 0);
  });

  // 城濮的城门：退满三舍才开
  gateDoor(g, done ? 1 : 0);
  ALLY_FLAGS.forEach((spot) => flag(g, spot.x, spot.y + (done ? 0 : 52), 0.9, THEME.teal));

  // 晋军：人和东西一起退
  cart(g, head.x + 78, head.y - 8, 0.72);
  soldier(g, head.x - 34, head.y, 0.95, THEME.teal, phase);
  soldier(g, head.x + 4, head.y, 0.88, THEME.redDeep, phase + 0.5);
  flag(g, head.x - 84, head.y + 6, 0.66, THEME.gold);
}

// ---------- 收尾 ----------

/** 收尾：整条退路都踩出来了，晋军站在城门下，城门大开，友军的旗都立着 */
export function drawFinale(g: Phaser.GameObjects.Graphics, level: TraceLevel): void {
  const stops = retreatStops(level);
  g.lineStyle(ROAD_STROKE.width + 16, THEME.outline, 0.5);
  g.beginPath();
  stops.forEach((stop, i) => (i === 0 ? g.moveTo(stop.x, stop.y) : g.lineTo(stop.x, stop.y)));
  g.strokePath();
  g.lineStyle(ROAD_STROKE.width, ROAD_STROKE.outer, 1);
  g.beginPath();
  stops.forEach((stop, i) => (i === 0 ? g.moveTo(stop.x, stop.y) : g.lineTo(stop.x, stop.y)));
  g.strokePath();
  g.lineStyle(ROAD_STROKE.width * 0.45, ROAD_STROKE.inner, 1);
  g.beginPath();
  stops.forEach((stop, i) => (i === 0 ? g.moveTo(stop.x, stop.y) : g.lineTo(stop.x, stop.y)));
  g.strokePath();

  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(SAFE_CAMP.x, SAFE_CAMP.y - 60, 240);

  // 两块里程碑都刻满了，第三舍就是城门本身：九十里，一舍没少
  for (const she of SHES.slice(0, -1)) post(g, she.x + POST_OFFSET, she.y, she.notches);

  // 城门大开，友军的旗立了起来
  gateDoor(g, 1);
  ALLY_FLAGS.forEach((spot) => flag(g, spot.x, spot.y, 0.95, THEME.teal));

  // 晋军连辎重车都进城了：人和东西一样没丢
  cart(g, SAFE_CAMP.x - 96, SAFE_CAMP.y - 26, 0.78);
  soldier(g, SAFE_CAMP.x - 176, SAFE_CAMP.y - 20, 0.95, THEME.teal, 0.25);
  soldier(g, SAFE_CAMP.x - 140, SAFE_CAMP.y - 16, 0.9, THEME.redDeep, 0.75);
  flag(g, SAFE_CAMP.x - 232, SAFE_CAMP.y - 10, 0.7, THEME.gold);
  // 尘土往北退回去了
  dustCloud(g, 470, 300, 0.6, 0.35);
}

// ---------- 分幕插图 ----------

function beatBackdrop(g: Phaser.GameObjects.Graphics, rect: { x: number; y: number; w: number; h: number }): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  hill(g, x + w * 0.16, y + h * 0.42, w * 0.34, h * 0.3, 0xa8cdb4);
  hill(g, x + w * 0.86, y + h * 0.42, w * 0.4, h * 0.24, 0x9ec7ad);
  g.fillStyle(FIELD, 1);
  g.fillRect(x - 10, y + h * 0.4, w + 20, h * 0.64);
}

/** ① 楚军追上来了，晋文公下令退 ② 退到城濮：城门开着，友军在等 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  beatBackdrop(g, rect);

  if (index === 0) {
    // 北边：追兵的尘土与旗号
    dustCloud(g, x + w * 0.24, y + h * 0.14, 1, 0.8);
    flag(g, x + w * 0.42, y + h * 0.2, 0.86, THEME.redDeep);
    flag(g, x + w * 0.58, y + h * 0.16, 0.7, THEME.redDeep);
    // 南边：晋军的营地与辎重车，一步一步往南走
    cart(g, x + w * 0.68, y + h * 0.78, 0.66);
    soldier(g, x + w * 0.5, y + h * 0.82, 0.86, THEME.teal, 0.3);
    soldier(g, x + w * 0.58, y + h * 0.84, 0.8, THEME.redDeep, 0.8);
    flag(g, x + w * 0.16, y + h * 0.82, 0.7, THEME.gold);
    // 往南的那条路：一步一步踩出来
    g.lineStyle(22, shade(SOIL, 1.1), 0.8);
    g.beginPath();
    g.moveTo(x + w * 0.34, y + h * 0.56);
    g.lineTo(x + w * 0.52, y + h * 0.72);
    g.lineTo(x + w * 0.62, y + h * 0.94);
    g.strokePath();
    return;
  }

  // ② 城濮：城墙、城门与友军的旗
  g.fillStyle(STONE, 1);
  g.fillRect(x - 10, y + h * 0.6, w + 20, h * 0.44);
  g.fillStyle(STONE_DEEP, 1);
  for (let px = x + 6; px < x + w - 20; px += 62) g.fillRect(px, y + h * 0.55, 42, 34);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRect(x - 10, y + h * 0.6, w + 20, h * 0.44);
  gateAt(g, x + w * 0.5, y + h * 0.6, y + h * 0.6 + 150, 58, 1);
  flag(g, x + w * 0.2, y + h * 0.58, 0.9, THEME.teal);
  flag(g, x + w * 0.8, y + h * 0.58, 0.9, THEME.teal);
  // 晋军连辎重车一起到城门下
  cart(g, x + w * 0.6, y + h * 0.72, 0.6);
  soldier(g, x + w * 0.36, y + h * 0.75, 0.84, THEME.teal, 0.2);
  soldier(g, x + w * 0.26, y + h * 0.78, 0.78, THEME.redDeep, 0.7);
  dustCloud(g, x + w * 0.86, y + h * 0.24, 0.56, 0.4);
}
