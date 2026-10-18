import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { SIEGE } from '@chags/templates/siege';
import type { SiegeSupportMetrics } from '@chags/templates';
import { clamp01 } from '@chags/game-kit';
import {
  BAR, FIRE, GRANARIES, HILLS, LOGS, LOG_RADIUS, MOON, NIGHT_TOP, RAIDERS, WOODPILE,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const NIGHT = 0x2b3550;
const NIGHT_DEEP = 0x1e2740;
const SKIN = 0xf8dcbb;

// ---------------- 景（每帧重画：火在变，景也得跟着呼吸） ----------------

/** 夜里的天：深蓝的底 + 一层更深的穹顶 + 月亮与几颗星 */
function drawNight(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, NIGHT_TOP, W, H - NIGHT_TOP);
  g.fillStyle(NIGHT_DEEP, 0.55);
  g.fillRect(0, NIGHT_TOP, W, 360);
  for (let i = 0; i < 14; i += 1) {
    const sx = 40 + ((i * 127) % 680);
    const sy = NIGHT_TOP + 30 + ((i * 83) % 300);
    const twinkle = 0.35 + 0.3 * Math.sin(t / 640 + i);
    g.fillStyle(THEME.paper, twinkle);
    g.fillCircle(sx, sy, 4);
  }
  g.fillStyle(THEME.paper, 0.92);
  g.fillCircle(MOON.x, MOON.y, MOON.r);
  g.fillStyle(NIGHT, 1);
  g.fillCircle(MOON.x - 18, MOON.y - 14, MOON.r - 6);
}

/** 远山：两个三角形，压住天与营地的交界 */
function drawHills(g: Phaser.GameObjects.Graphics): void {
  for (const hill of HILLS) {
    const half = 190 * hill.s;
    const tall = 210 * hill.s;
    g.fillStyle(shade(NIGHT_DEEP, 1.25), 1);
    g.fillTriangle(hill.x - half, hill.y, hill.x, hill.y - tall, hill.x + half, hill.y);
    g.lineStyle(6, THEME.outline, 0.7);
    g.strokeTriangle(hill.x - half, hill.y, hill.x, hill.y - tall, hill.x + half, hill.y);
    g.fillStyle(shade(NIGHT, 1.15), 0.85);
    g.fillTriangle(
      hill.x - half * 0.32, hill.y - tall * 0.62,
      hill.x, hill.y - tall,
      hill.x + half * 0.32, hill.y - tall * 0.62,
    );
  }
}

/** 一座粮囤：草顶的圆仓 + 一圈捆绳（火烧到这儿就是烧到根上了） */
function drawGranary(
  g: Phaser.GameObjects.Graphics,
  granary: { x: number; y: number; r: number },
  captured: boolean,
): void {
  const { x, y, r } = granary;
  groundShadow(g, x, y + r * 0.86, r * 2.2, r * 0.5, 0.22);
  const body = captured ? shade(THEME.teal, 0.94) : shade(THEME.sand, 0.98);
  roundRect(g, x - r * 0.72, y - r * 0.2, r * 1.44, r * 1.16, r * 0.34, body, THEME.outline, 6);
  g.lineStyle(5, shade(THEME.sandDeep, 0.9), 0.9);
  for (let i = 1; i < 4; i += 1) {
    const ly = y - r * 0.2 + (r * 1.16 * i) / 4;
    g.lineBetween(x - r * 0.7, ly, x + r * 0.7, ly);
  }
  // 草顶
  g.fillStyle(shade(THEME.goldDeep, 0.98), 1);
  g.fillTriangle(x - r * 0.96, y - r * 0.16, x, y - r * 1.02, x + r * 0.96, y - r * 0.16);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - r * 0.96, y - r * 0.16, x, y - r * 1.02, x + r * 0.96, y - r * 0.16);
  if (!captured) return;
  // 拿下了：粮囤上插一面自家的旗
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x, y - r * 0.98, x, y - r * 1.7);
  g.fillStyle(THEME.teal, 1);
  g.fillTriangle(x, y - r * 1.7, x + r * 0.62, y - r * 1.5, x, y - r * 1.3);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x, y - r * 1.7, x + r * 0.62, y - r * 1.5, x, y - r * 1.3);
}

/** 一根柴：一根木头（两头是圆的），angle 是它躺的方向 */
function drawLog(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angleDeg: number,
  alpha = 1,
): void {
  const a = (angleDeg * Math.PI) / 180;
  // 木头画多长：比命中半径长一点（画在哪儿与关卡数据锁在 layout.ts 里）
  const half = LOG_RADIUS * 0.72;
  const dx = Math.cos(a) * half;
  const dy = Math.sin(a) * half;
  g.lineStyle(40, THEME.outline, alpha);
  g.lineBetween(x - dx, y - dy, x + dx, y + dy);
  g.lineStyle(30, THEME.wood, alpha);
  g.lineBetween(x - dx, y - dy, x + dx, y + dy);
  circle(g, x - dx, y - dy, 16, THEME.wood, THEME.outline, 5, alpha);
  circle(g, x + dx, y + dy, 16, shade(THEME.wood, 0.88), THEME.outline, 5, alpha);
  g.lineStyle(5, THEME.woodDeep, alpha);
  g.lineBetween(x - dx * 0.1, y - dy * 0.1, x + dx * 0.42, y + dy * 0.42);
}

/** 一根柴这一刻在哪儿：抽走的柴会一路挪到左下角的柴堆上（只要位置，不关心 relief） */
function logView(
  log: { id: string; x: number; y: number },
  stage: SiegeSupportMetrics,
): { x: number; y: number; angle: number; alpha: number } {
  const angle = (Math.atan2(log.y - FIRE.y, log.x - FIRE.x) * 180) / Math.PI;
  const index = stage.pulled.indexOf(log.id);
  if (index < 0) return { x: log.x, y: log.y, angle, alpha: 1 };
  const pileX = WOODPILE.x + (index % 2) * 92;
  const pileY = WOODPILE.y - Math.floor(index / 2) * 52;
  const pileAngle = 8 + index * 32;
  const moving = stage.lastPull?.id === log.id && stage.lastPullAtMs >= 0;
  if (!moving) return { x: pileX, y: pileY, angle: pileAngle, alpha: 0.92 };
  const p = clamp01((stage.elapsedMs - stage.lastPullAtMs) / SIEGE.pullHoldMs);
  const ease = p * p * (3 - 2 * p);
  return {
    x: log.x + (pileX - log.x) * ease,
    y: log.y + (pileY - log.y) * ease,
    angle: angle + (pileAngle - angle) * ease,
    alpha: 1 - 0.08 * ease,
  };
}

/** 火堆：石圈 + 火焰（大小跟着火势）+ 烟；火灭了只剩一缕青烟与余烬 */
function drawFire(g: Phaser.GameObjects.Graphics, stage: SiegeSupportMetrics): void {
  const t = stage.elapsedMs;
  const fire = stage.fireMax > 0 ? clamp01(stage.fireLevel / stage.fireMax) : 0;

  // 火堆底下的石圈
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    circle(
      g,
      FIRE.x + Math.cos(a) * 104,
      FIRE.y + 56 + Math.sin(a) * 36,
      15,
      shade(THEME.stone, 0.86),
      THEME.outline,
      4,
    );
  }

  if (fire <= 0) {
    // 灭了：只剩余烬与一缕烟
    g.fillStyle(shade(THEME.inkSoft, 0.7), 0.5);
    g.fillEllipse(FIRE.x, FIRE.y + 44, 176, 44);
    for (let i = 0; i < 3; i += 1) {
      const p = ((t / 1800) + i / 3) % 1;
      g.fillStyle(THEME.stone, 0.16 * (1 - p));
      g.fillCircle(FIRE.x + 26 + Math.sin(p * 5 + i) * 40, FIRE.y + 20 - p * 300, 26 + 34 * p);
    }
    return;
  }

  // 烟：火越大烟越淡（烧得旺），快灭时烟最浓
  const smoke = 0.1 + 0.22 * (1 - fire);
  for (let i = 0; i < 4; i += 1) {
    const p = ((t / 1500) + i / 4) % 1;
    g.fillStyle(THEME.stone, smoke * (1 - p));
    g.fillCircle(
      FIRE.x + 34 + Math.sin(p * 6 + i) * 52,
      FIRE.y - 40 - p * 330,
      28 + 42 * p,
    );
  }

  // 火焰：三层（深红 / 红 / 金），高度跟着火势，火苗一直抖
  const layers = [
    { scale: 1, color: THEME.redDeep },
    { scale: 0.74, color: THEME.red },
    { scale: 0.46, color: THEME.gold },
  ] as const;
  for (const layer of layers) {
    const flick = Math.sin(t / 130 + layer.scale * 4) * (5 + 9 * fire);
    const tall = (70 + 150 * fire) * layer.scale + flick;
    const half = (72 + 66 * fire) * layer.scale;
    g.fillStyle(layer.color, 1);
    g.beginPath();
    g.moveTo(FIRE.x - half, FIRE.y + 46);
    g.lineTo(FIRE.x - half * 0.52 + flick * 0.4, FIRE.y + 46 - tall * 0.58);
    g.lineTo(FIRE.x + flick, FIRE.y + 46 - tall);
    g.lineTo(FIRE.x + half * 0.52 + flick * 0.4, FIRE.y + 46 - tall * 0.58);
    g.lineTo(FIRE.x + half, FIRE.y + 46);
    g.closePath();
    g.fillPath();
  }
}

/** 一个摸上来的兵：斗篷 + 头 + 火把 */
function drawRaider(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  t: number,
  index: number,
): void {
  const bob = Math.sin(t / 420 + index) * 4;
  const top = y - 96 - bob;
  groundShadow(g, x, y + 10, 112, 26, 0.28);
  roundRect(g, x - 32, top, 64, 96, 22, shade(THEME.teal, 0.94), THEME.outline, 6);
  g.lineStyle(8, THEME.tealDeep, 1);
  g.lineBetween(x - 30, top + 46, x + 30, top + 46);
  circle(g, x, top - 26, 25, SKIN, THEME.outline, 6);
  circle(g, x, top - 46, 20, THEME.inkSoft, THEME.outline, 5);
  // 火把：一根木杆 + 一小团跟着抖的火
  const tx = x + 52;
  const ty = top + 6;
  g.lineStyle(9, THEME.woodDeep, 1);
  g.lineBetween(x + 26, top + 34, tx, ty);
  const flick = Math.sin(t / 90 + index * 2) * 5;
  g.fillStyle(THEME.gold, 1);
  g.fillEllipse(tx, ty - 16 + flick * 0.4, 34, 52 + flick);
  g.fillStyle(THEME.red, 1);
  g.fillEllipse(tx, ty - 28 + flick * 0.4, 20, 30 + flick * 0.6);
}

/** 灭火的进度条：火势到 0 就满格 */
function drawBar(g: Phaser.GameObjects.Graphics, stage: SiegeSupportMetrics): void {
  roundRect(g, BAR.x, BAR.y, BAR.w, BAR.h, BAR.h / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  const inner = BAR.w - 12;
  const fill = Math.max(0, Math.min(inner, inner * stage.ratio));
  if (fill > 8) {
    roundRect(
      g,
      BAR.x + 6,
      BAR.y + 6,
      fill,
      BAR.h - 12,
      (BAR.h - 12) / 2,
      stage.done ? THEME.teal : THEME.gold,
      null,
      0,
    );
  }
  // 还没抽掉的柴：一根一根小木条，看得见"还剩几根"
  for (let i = 0; i < stage.total; i += 1) {
    const bx = BAR.x + 40 + i * ((BAR.w - 80) / Math.max(1, stage.total - 1));
    const gone = i < stage.pulled.length;
    g.fillStyle(gone ? shade(THEME.wood, 0.7) : THEME.woodDeep, gone ? 0.4 : 1);
    g.fillRect(bx - 5, BAR.y - 20, 10, 14);
  }
}

// ---------------- 每帧 ----------------

/** 每帧：夜色、粮囤、火堆、五根柴（抽走的挪到柴堆上）、摸上来的兵、进度条 */
export function drawSupport(g: Phaser.GameObjects.Graphics, stage: SiegeSupportMetrics): void {
  drawNight(g, stage.elapsedMs);
  drawHills(g);
  for (const granary of GRANARIES) drawGranary(g, granary, stage.done || stage.basePulled);
  drawFire(g, stage);
  for (const log of LOGS) {
    const view = logView(log, stage);
    drawLog(g, view.x, view.y, view.angle, view.alpha);
  }
  RAIDERS.forEach((raider, index) =>
    drawRaider(g, raider.x, raider.y, stage.elapsedMs, index),
  );
  drawBar(g, stage);
}

/** 火灭了：烟散了，粮囤上插起自家的旗，一圈金光罩住营地 */
export function drawSupportFinale(
  g: Phaser.GameObjects.Graphics,
  stage: SiegeSupportMetrics,
): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(FIRE.x, FIRE.y, 320);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(FIRE.x, FIRE.y, 268);
  for (const granary of GRANARIES) {
    g.lineStyle(8, THEME.gold, 0.45);
    g.strokeCircle(granary.x, granary.y, granary.r * 1.5);
  }
  if (stage.ratio >= 1) {
    g.fillStyle(THEME.paper, 0.9);
    g.fillEllipse(FIRE.x, FIRE.y + 60, 210, 54);
  }
}

/** 分幕插图：① 乌巢的粮囤堆成小山 ② 夜里举着火把摸进去 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.paper, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.98), 1);
  g.fillRoundedRect(x, y + h * 0.66, w, h * 0.34, 30);

  if (index === 0) {
    // ① 粮囤像小山：三个囤 + 一辆还在卸的粮车
    for (let i = 0; i < 3; i += 1) {
      const gx = x + w * (0.2 + i * 0.3);
      drawGranary(g, { x: gx, y: y + h * 0.58, r: 70 }, false);
    }
    roundRect(g, x + w * 0.1, y + h * 0.8, w * 0.28, h * 0.1, 14, THEME.wood, THEME.outline, 6);
    circle(g, x + w * 0.15, y + h * 0.92, 18, shade(THEME.stone, 0.9), THEME.outline, 5);
    circle(g, x + w * 0.33, y + h * 0.92, 18, shade(THEME.stone, 0.9), THEME.outline, 5);
    return;
  }

  // ② 夜里：一排兵举着火把，火把照亮了粮囤
  g.fillStyle(NIGHT_DEEP, 0.32);
  g.fillRoundedRect(x, y, w, h * 0.66, 30);
  drawGranary(g, { x: x + w * 0.76, y: y + h * 0.5, r: 66 }, false);
  for (let i = 0; i < 3; i += 1) {
    drawRaider(g, x + w * (0.2 + i * 0.18), y + h * 0.78, i * 400, i);
  }
}
