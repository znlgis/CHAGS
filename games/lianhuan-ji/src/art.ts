import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { chainDominoBar, chainDominoWindowBar } from '@chags/templates';
import type { ChainDominoMetrics } from '@chags/templates';
import type { ChainDominoLevel } from '@chags/templates/schemas';
import { clamp01 } from '@chags/game-kit';
import {
  BOAT_LENGTH, CHAIN_WIDTH, DESIGN_H, DESIGN_W, IGNITE, RING_RADIUS, RINGS, RIVER_TOP, SHORE_Y,
  SKY_TOP, WAVES,
} from './layout';

/**
 * 第 35 计的这一屏：**夜里的江面，没有一场交战**。
 *
 * 南岸的沙滩上有一堆火种（起头的地方）；江面上，四条船团用铁索一环一环连起来，
 * 一路连到最北边那片连环的大船。孩子先点着火种，再按顺序一环一环点亮船上的信号火把 ——
 * 火顺着铁索一环一环往下走，中间不能断；断了就回到岸边重新点一次（零惩罚）。
 */

const NIGHT = 0x24405e;
const WATER = 0x32618c;
const WATER_LIGHT = 0x4d84b0;
const SHORE = 0xe6cf9c;
const SHORE_DEEP = 0xc9ac74;
const HULL = 0x9a6238;
const HULL_LIGHT = 0xb87a45;
const DECK = 0xe3cfa4;
const SAIL = 0xf1e3c2;
const CHAIN_IRON = 0x8b95a3;
const CHAIN_DEEP = 0x565d68;


// ---------------- 江面与岸 ----------------

/** 江水、水纹与南岸的沙滩 */
function drawRiver(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, SKY_TOP, DESIGN_W, DESIGN_H - SKY_TOP);
  g.fillStyle(WATER, 1);
  g.fillRect(0, RIVER_TOP, DESIGN_W, SHORE_Y - RIVER_TOP + 12);
  // 远一点的水色压一条，江面就有纵深
  g.fillStyle(shade(WATER, 0.86), 1);
  g.fillRect(0, RIVER_TOP, DESIGN_W, 96);
  // 靠南岸这一片水色浅一点（火种那一带的江面）
  wavyBand(g, 0, SHORE_Y - 168, DESIGN_W, 120, WATER_LIGHT, 0.34, 10, 3.5);
  for (const wave of WAVES) {
    wavyBand(g, wave.x - wave.w / 2, wave.y, wave.w, 12, WATER_LIGHT, wave.a * 0.5, 5, 2);
  }
  // 南岸的沙滩：起头的火种就在岸上
  g.fillStyle(SHORE_DEEP, 1);
  g.fillRect(0, SHORE_Y, DESIGN_W, DESIGN_H - SHORE_Y);
  g.fillStyle(SHORE, 1);
  wavyBand(g, 0, SHORE_Y - 16, DESIGN_W, 40, SHORE, 1, 9, 4);
}

// ---------------- 铁索 ----------------

/** 一段铁索：一环扣一环的铁圈 —— 亮着的那几段是火正在走的路 */
function drawChain(
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  lit: boolean,
): void {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const links = Math.max(2, Math.round(dist / 30));
  g.lineStyle(CHAIN_WIDTH, lit ? THEME.goldDeep : CHAIN_DEEP, 1);
  g.lineBetween(from.x, from.y, to.x, to.y);
  for (let i = 1; i < links; i += 1) {
    const p = i / links;
    const x = from.x + (to.x - from.x) * p;
    const y = from.y + (to.y - from.y) * p;
    circle(
      g,
      x,
      y,
      CHAIN_WIDTH * (lit ? 0.78 : 0.62),
      lit ? THEME.gold : CHAIN_IRON,
      THEME.outline,
      3,
    );
  }
}

// ---------------- 船 ----------------

/** 一条小船：船身 + 桅杆 + 帆 */
function drawBoat(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  const half = BOAT_LENGTH / 2;
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  groundShadow(g, 0, 34, BOAT_LENGTH * 1.33, 36, 0.18);
  roundRect(g, -half, -28, half * 2, 58, 22, HULL, THEME.outline, 6);
  g.fillStyle(HULL_LIGHT, 0.7);
  g.fillRoundedRect(-half + 8, -22, half * 2 - 16, 16, 8);
  roundRect(g, -52, -14, 104, 30, 14, DECK, null, 0, 0.9);
  g.lineStyle(7, THEME.outline, 1);
  g.lineBetween(0, -28, 0, -104);
  g.fillStyle(SAIL, 1);
  g.fillTriangle(4, -100, 4, -36, 62, -66);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(4, -100, 4, -36, 62, -66);
  g.restore();
}

/** 一环船团上的信号火把：亮着的那几环才烧着火 */
function drawFlame(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, t: number): void {
  const bob = Math.sin(t / 140) * 4;
  g.fillStyle(THEME.red, 0.95);
  g.fillTriangle(x - 22 * s, y + 20 * s, x + 22 * s, y + 20 * s, x, y - 46 * s + bob);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x - 13 * s, y + 18 * s, x + 13 * s, y + 18 * s, x + 2 * s, y - 24 * s + bob);
  g.fillStyle(0xfff3c4, 1);
  g.fillTriangle(x - 6 * s, y + 16 * s, x + 6 * s, y + 16 * s, x + 1 * s, y - 8 * s + bob);
}

/**
 * 一环船团：三条船并排锁在铁索上，中间立一根信号火把。
 * - 亮着：火把烧起来，船身外面一圈暖光；
 * - 就是下一环：外圈呼吸（还没轮到也亮着，等着）；
 * - 还没轮到：火把是暗的。
 */
function drawRing(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  lit: boolean,
  next: boolean,
  t: number,
  id: string,
): void {
  const scale = id === 'ring-4' ? 0.8 : 0.66;
  for (let i = 0; i < 3; i += 1) {
    const dx = (i - 1) * 62 * scale;
    drawBoat(g, x + dx, y + (i === 1 ? -24 : 8), scale);
  }
  // 信号火把立在这一环中间
  const top = y - 74;
  g.lineStyle(6, THEME.woodDeep, 1);
  g.lineBetween(x, y - 12, x, top);
  if (lit) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillCircle(x, y, RING_RADIUS + 26);
    drawFlame(g, x, top - 12, 1, t + x * 0.7);
  } else {
    circle(g, x, top - 10, 15, shade(THEME.stone, 0.92), THEME.outline, 4);
  }
  if (next) {
    const p = (Math.sin(t / 420) + 1) / 2;
    g.lineStyle(7, THEME.gold, 0.3 + 0.3 * p);
    g.strokeCircle(x, y, RING_RADIUS + 12 + 8 * p);
  }
}

/** 南岸的火种：起头的地方（链子没在走的时候它更亮，等着孩子回来点） */
function drawFirePit(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hot: boolean,
  t: number,
): void {
  groundShadow(g, x, y + 30, 210, 42, 0.2);
  for (let i = 0; i < 5; i += 1) {
    const a = Math.PI * (0.12 + i * 0.19);
    circle(g, x + Math.cos(a) * 58, y + 22 + Math.sin(a) * 15, 16, THEME.stone, THEME.outline, 4);
  }
  g.lineStyle(12, THEME.woodDeep, 1);
  g.lineBetween(x - 42, y + 18, x + 42, y + 2);
  g.lineBetween(x - 42, y + 2, x + 42, y + 18);
  if (hot) {
    g.fillStyle(THEME.gold, 0.18);
    g.fillCircle(x, y + 6, IGNITE.radius * 0.86);
    drawFlame(g, x, y - 4, 1.15, t);
  }
}

// ---------------- 景（画一次） ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: ChainDominoLevel): void {
  drawRiver(g);
  // 铁索：从南岸的火种一环一环连到最北边的大船团（还没点亮时是暗的）
  let prev = { x: level.ignite.x, y: level.ignite.y };
  for (const link of level.links) {
    drawChain(g, prev, { x: link.x, y: link.y }, false);
    prev = { x: link.x, y: link.y };
  }
  // 火种与四环船团 —— 位置一律用关卡数据（美术画在哪儿，关卡数据就得在哪儿）
  drawFirePit(g, level.ignite.x, level.ignite.y - 6, true, 0);
  for (const link of level.links) {
    const spot = RINGS.find((item) => item.id === link.id);
    if (spot === undefined) continue;
    drawRing(g, link.x, link.y, false, false, 0, spot.id);
  }
}

// ---------------- 每帧 ----------------

/** 每帧：点亮的几段铁索、烧起来的火把、下一环的呼吸、这一环还剩多久 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: ChainDominoMetrics,
  level: ChainDominoLevel,
): void {
  const t = stage.elapsedMs;
  // 火顺着铁索走：点亮了的那几段是金色的
  let prev = { x: level.ignite.x, y: level.ignite.y };
  for (const link of level.links) {
    drawChain(g, prev, { x: link.x, y: link.y }, stage.lit.includes(link.id));
    prev = { x: link.x, y: link.y };
  }
  // 四环：亮着的烧着火把，就是下一环的在呼吸
  for (const link of level.links) {
    drawRing(
      g,
      link.x,
      link.y,
      stage.lit.includes(link.id),
      stage.nextLink?.id === link.id,
      t,
      link.id,
    );
  }
  // 火种：链子没在走（还没起头 / 断了）的时候更亮 —— 就是该回这儿来
  drawFirePit(g, level.ignite.x, level.ignite.y - 6, true, t);
  if (!stage.running && !stage.done) {
    const p = (Math.sin(t / 360) + 1) / 2;
    g.lineStyle(9, THEME.gold, 0.34 + 0.34 * p);
    g.strokeCircle(level.ignite.x, level.ignite.y, level.ignite.radius + 26 + 8 * p);
  }
  // 这一环还剩多久：下一环外面那圈光随时间收小（时间到了它就没了 —— 链子就断了）
  if (stage.running && stage.nextLink) {
    const ratio = clamp01(stage.remainingMs / Math.max(1, stage.windowMs));
    g.lineStyle(10, THEME.gold, 0.2 + 0.5 * ratio);
    g.strokeCircle(stage.nextLink.x, stage.nextLink.y, RING_RADIUS + 20 + 66 * ratio);
  }
  chainDominoBar(g, level, stage.litCount);
  chainDominoWindowBar(g, level, stage.remainingMs);
}

/** 收尾：整条铁索亮起来，四环都烧着信号火把 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: ChainDominoMetrics,
  level: ChainDominoLevel,
): void {
  void stage;
  g.fillStyle(THEME.gold, 0.12);
  g.fillRect(0, SKY_TOP, DESIGN_W, DESIGN_H - SKY_TOP);
  let prev = { x: level.ignite.x, y: level.ignite.y };
  for (const link of level.links) {
    drawChain(g, prev, { x: link.x, y: link.y }, true);
    prev = { x: link.x, y: link.y };
  }
  for (const link of level.links) drawRing(g, link.x, link.y, true, false, 0, link.id);
  g.lineStyle(12, THEME.gold, 0.6);
  g.strokeCircle(level.ignite.x, level.ignite.y, level.ignite.radius + 40);
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 铁索连船 ② 火一环一环顺着铁索往下走 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(NIGHT, 1);
  g.fillRoundedRect(x, y, w, h * 0.62, 30);
  g.fillStyle(WATER, 1);
  g.fillRoundedRect(x, y + h * 0.2, w, h * 0.42, 26);
  wavyBand(g, x, y + h * 0.5, w, h * 0.12, WATER_LIGHT, 0.35, 8, 3);

  if (index === 0) {
    // ① 三条船并排，铁索把它们一环一环锁在一起
    const y0 = y + h * 0.54;
    for (let i = 0; i < 3; i += 1) drawBoat(g, x + w * (0.26 + i * 0.24), y0, 0.5);
    g.lineStyle(9, CHAIN_DEEP, 1);
    g.lineBetween(x + w * 0.16, y0 + 26, x + w * 0.84, y0 + 26);
    for (let i = 0; i < 5; i += 1) {
      circle(g, x + w * (0.2 + i * 0.15), y0 + 26, 8, CHAIN_IRON, THEME.outline, 3);
    }
    return;
  }

  // ② 火一环一环顺着铁索走：四环依次亮起来
  const points = [
    { x: x + w * 0.16, y: y + h * 0.8 },
    { x: x + w * 0.42, y: y + h * 0.62 },
    { x: x + w * 0.66, y: y + h * 0.74 },
    { x: x + w * 0.84, y: y + h * 0.5 },
  ];
  g.lineStyle(22, shade(CHAIN_IRON, 0.9), 1);
  for (let i = 0; i + 1 < points.length; i += 1) {
    g.lineBetween(points[i]!.x, points[i]!.y, points[i + 1]!.x, points[i + 1]!.y);
  }
  points.forEach((point, i) => {
    circle(g, point.x, point.y, 26, i < 3 ? THEME.gold : shade(THEME.stone, 0.92), THEME.outline, 5);
    if (i < 3) drawFlame(g, point.x, point.y - 8, 0.42, 0);
  });
}
