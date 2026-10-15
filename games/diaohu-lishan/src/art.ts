import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { LureStageState } from '@chags/templates';
import type { LureLevel } from '@chags/templates/schemas';
import {
  BAIT_RADIUS, CHEST, FAR_BOTTOM, FAR_HILLS, GROUND_TOP, GUARD_H, HAMLET, PASS, PATH,
  RIDGE_BOTTOM, SKY_TOP,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 黄昏的配色：山那边暖，山这边暗 —— 孩子一眼看得出"哪边有动静" */
const DUSK = 0xa8cfec;
const WARM = 0xf6c98d;
const HILL = 0x8fb0c6;
const HILL_WARM = 0xa9bfc4;
const ROCK = 0x6d6660;
const ROCK_LIGHT = 0x8f887c;
const MEADOW = 0x8fbf72;
const MEADOW_DEEP = 0x6fa257;
const SMOKE = 0xf4f7f8;
const HUT = 0xb98a5c;

// ---------------- 小零件 ----------------

/** 一只小灯笼 / 一点灯火：亮的才看得见是"那边有人" */
function drawLight(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, glow: number): void {
  if (glow > 0) {
    g.fillStyle(THEME.gold, 0.18 + 0.28 * glow);
    g.fillCircle(x, y, r * (2.4 + glow));
  }
  circle(g, x, y, r, glow > 0.2 ? THEME.gold : shade(THEME.gold, 0.72), THEME.outline, 4);
  if (glow > 0.2) {
    g.fillStyle(THEME.paper, 0.9);
    g.fillCircle(x - r * 0.22, y - r * 0.22, r * 0.34);
  }
}

/** 一缕炊烟：从某个地方升起来（elapsed 让它一直在动） */
function drawSmoke(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  elapsedMs: number,
  alpha = 0.5,
): void {
  for (let i = 0; i < 3; i += 1) {
    const phase = ((elapsedMs / 2600 + i * 0.33) % 1 + 1) % 1;
    const px = x + Math.sin(phase * Math.PI * 2) * 22;
    const py = y - phase * 100;
    if (py < SKY_TOP + 24) continue; // 飘到标题条底下就够了
    g.fillStyle(SMOKE, alpha * (1 - phase) * (0.5 + i * 0.2));
    g.fillEllipse(px, py, 30 + phase * 44, 24 + phase * 34);
  }
}

/** 一丛草 */
function drawGrass(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  g.lineStyle(7 * s, MEADOW_DEEP, 1);
  g.lineBetween(x, y, x - 20 * s, y - 40 * s);
  g.lineBetween(x, y, x + 4 * s, y - 52 * s);
  g.lineBetween(x, y, x + 24 * s, y - 34 * s);
}

/** 一块石头 */
function drawStone(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(THEME.stone, 1);
  g.fillEllipse(x, y, r * 2, r * 1.3);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x, y, r * 2, r * 1.3);
}

/**
 * 守将：站在山口的那一位。s = 1 大约 GUARD_H 高。
 * alert = 他正盯着山那边看（诱饵起作用了）—— 头上冒一个"!"，不用一个字。
 */
function drawGuard(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  alert: boolean,
): void {
  const h = GUARD_H * s;
  const foot = y + 6 * s;
  groundShadow(g, x, foot, 118 * s, 30 * s, 0.2);
  // 长矛（竖着，矛尖朝上）：一眼看出他是守将
  g.lineStyle(12 * s, THEME.woodDeep, 1);
  g.lineBetween(x + 52 * s, foot, x + 52 * s, foot - h * 1.16);
  g.fillStyle(THEME.stone, 1);
  g.fillTriangle(x + 52 * s, foot - h * 1.32, x + 38 * s, foot - h * 1.1, x + 66 * s, foot - h * 1.1);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x + 52 * s, foot - h * 1.32, x + 38 * s, foot - h * 1.1, x + 66 * s, foot - h * 1.1);
  // 身子：一件披风
  roundRect(g, x - 40 * s, foot - h * 0.72, 80 * s, h * 0.74, 26 * s, THEME.tealDeep, THEME.outline, 6 * s);
  g.fillStyle(shade(THEME.teal, 0.92), 1);
  g.fillEllipse(x, foot - h * 0.34, 74 * s, 46 * s);
  // 腰带
  g.lineStyle(9 * s, THEME.goldDeep, 1);
  g.lineBetween(x - 34 * s, foot - h * 0.44, x + 34 * s, foot - h * 0.44);
  // 头与头盔
  circle(g, x, foot - h * 0.9, 32 * s, 0xf8dcbb, THEME.outline, 6 * s);
  g.fillStyle(THEME.stone, 1);
  g.fillTriangle(x - 40 * s, foot - h * 0.98, x + 40 * s, foot - h * 0.98, x, foot - h * 1.22);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x - 40 * s, foot - h * 0.98, x + 40 * s, foot - h * 0.98, x, foot - h * 1.22);
  // 眼睛：盯着哪边
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + 11 * s, foot - h * 0.9, 4 * s);
  g.fillCircle(x - 9 * s, foot - h * 0.9, 4 * s);
  if (!alert) return;
  // 有动静！—— 头上一个"!"，没有字
  const bx = x;
  const by = foot - h * 1.5;
  roundRect(g, bx - 8 * s, by - 34 * s, 16 * s, 44 * s, 8 * s, THEME.gold, THEME.outline, 5 * s);
  circle(g, bx, by + 24 * s, 9 * s, THEME.gold, THEME.outline, 5 * s);
}

/** 要搬走的箱子 */
function drawChest(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  lift: number,
  alpha = 1,
): void {
  const w = CHEST.w * s;
  const h = CHEST.h * s;
  const shake = lift > 0 ? Math.sin(lift * 40) * 4 * lift : 0;
  const cx = x + shake;
  const cy = y - lift * 26;
  groundShadow(g, x, y + h * 0.5 + 10, w * 1.15, h * 0.34, 0.22 * alpha);
  roundRect(g, cx - w / 2, cy - h * 0.3, w, h * 0.84, 16, THEME.wood, THEME.outline, 7, alpha);
  roundRect(g, cx - w / 2, cy - h * 0.62, w, h * 0.42, 18, shade(THEME.wood, 1.16), THEME.outline, 7, alpha);
  // 两道铁箍
  g.lineStyle(9, THEME.goldDeep, alpha);
  g.lineBetween(cx - w * 0.28, cy - h * 0.62, cx - w * 0.28, cy + h * 0.5);
  g.lineBetween(cx + w * 0.28, cy - h * 0.62, cx + w * 0.28, cy + h * 0.5);
  circle(g, cx, cy - h * 0.16, 15, THEME.gold, THEME.outline, 5, alpha);
}

/** 一个诱饵点：山那边的石台 + 一捆干柴（点了火就是"那边闹起来了"） */
function drawBaitSpot(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  lit: boolean,
  used: boolean,
): void {
  g.fillStyle(shade(HILL, 0.86), 1);
  g.fillEllipse(x, y + BAIT_RADIUS * 0.5, BAIT_RADIUS * 1.9, BAIT_RADIUS * 0.7);
  g.lineStyle(5, THEME.outline, 0.5);
  g.strokeEllipse(x, y + BAIT_RADIUS * 0.5, BAIT_RADIUS * 1.9, BAIT_RADIUS * 0.7);
  // 一捆干柴
  for (let i = 0; i < 4; i += 1) {
    const a = (-0.5 + i * 0.34) * Math.PI * 0.5;
    g.lineStyle(9, THEME.woodDeep, 1);
    g.lineBetween(x, y + 16, x + Math.sin(a) * 40, y + 16 - Math.cos(a) * 44);
  }
  if (!lit) {
    // 还没点着：安静的一小堆
    g.lineStyle(6, shade(THEME.woodDeep, 0.8), 0.8);
    g.lineBetween(x - 26, y + 22, x + 26, y + 12);
    return;
  }
  // 点着了：火苗（闹起来的就是它）
  g.fillStyle(THEME.gold, 0.95);
  g.fillTriangle(x - 24, y + 8, x + 24, y + 8, x, y - 52);
  g.fillStyle(THEME.red, 0.95);
  g.fillTriangle(x - 14, y + 6, x + 14, y + 6, x + 2, y - 30);
  if (used) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillCircle(x, y - 10, 96);
  }
}

// ---------------- 景 ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: LureLevel): void {
  // 黄昏的天（标题条下面开始）
  g.fillStyle(DUSK, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle(WARM, 0.04 + i * 0.02);
    g.fillRect(0, FAR_BOTTOM - i * 40, W, 46);
  }
  // 几片薄云
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(SMOKE, 0.24 - i * 0.05);
    g.fillEllipse(120 + i * 260, 208 + i * 26, 260, 52);
  }

  // 山那边的三座远山：山顶就是三个诱饵点
  for (const hill of FAR_HILLS) {
    g.fillStyle(shade(HILL, 0.92), 0.55);
    g.fillEllipse(hill.x, hill.y + hill.r * 0.42, hill.r * 2.3, hill.r * 1.5);
  }
  for (const hill of FAR_HILLS) {
    g.fillStyle(HILL_WARM, 0.92);
    g.fillEllipse(hill.x, hill.y + hill.r * 0.5, hill.r * 1.9, hill.r * 1.2);
  }

  // 山那边的小村（只有一点轮廓，灯火在画面上层亮起来）
  g.fillStyle(HUT, 0.95);
  g.fillRect(HAMLET.x - 96, HAMLET.y - 18, 70, 44);
  g.fillStyle(shade(HUT, 0.82), 1);
  g.fillTriangle(HAMLET.x - 104, HAMLET.y - 18, HAMLET.x + 12, HAMLET.y - 18, HAMLET.x - 46, HAMLET.y - 62);
  g.fillStyle(HUT, 0.95);
  g.fillRect(HAMLET.x + 26, HAMLET.y - 10, 62, 38);
  g.fillStyle(shade(HUT, 0.82), 1);
  g.fillTriangle(HAMLET.x + 20, HAMLET.y - 10, HAMLET.x + 98, HAMLET.y - 10, HAMLET.x + 58, HAMLET.y - 50);

  // 近处的山脊：中间给山口留一个豁口
  g.fillStyle(ROCK, 1);
  g.beginPath();
  g.moveTo(-40, RIDGE_BOTTOM);
  g.lineTo(-40, 800);
  g.lineTo(60, 660);
  g.lineTo(210, 540);
  g.lineTo(306, 468);
  g.lineTo(PASS.x - 50, PASS.y);
  g.lineTo(PASS.x + 50, PASS.y);
  g.lineTo(444, 468);
  g.lineTo(540, 540);
  g.lineTo(690, 660);
  g.lineTo(790, 800);
  g.lineTo(790, RIDGE_BOTTOM);
  g.closePath();
  g.fillPath();
  // 山脊的亮面（顺着光）
  g.fillStyle(ROCK_LIGHT, 0.5);
  g.beginPath();
  g.moveTo(210, 540);
  g.lineTo(306, 468);
  g.lineTo(PASS.x - 50, PASS.y);
  g.lineTo(PASS.x - 30, PASS.y);
  g.lineTo(300, 500);
  g.closePath();
  g.fillPath();
  // 山口的石阶：告诉孩子"这里就是那条路"
  g.fillStyle(ROCK_LIGHT, 0.85);
  for (let i = 0; i < 3; i += 1) {
    g.fillRect(PASS.x - 46 + i * 3, PASS.y + 6 + i * 22, 92 - i * 6, 14);
  }

  // 山脚的草坡
  g.fillStyle(MEADOW, 1);
  g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  wavyBand(g, -20, GROUND_TOP - 26, W + 40, 60, MEADOW, 1, 10, 3);
  // 下山的小路
  g.lineStyle(46, shade(MEADOW, 0.86), 1);
  g.beginPath();
  g.moveTo(PATH[0]!.x, PATH[0]!.y);
  for (let i = 1; i < PATH.length; i += 1) g.lineTo(PATH[i]!.x, PATH[i]!.y);
  g.strokePath();
  g.lineStyle(6, shade(MEADOW_DEEP, 0.9), 0.5);
  g.strokePath();

  // 草丛与石头（山脚那一段）
  drawGrass(g, 120, 1090);
  drawGrass(g, 268, 1256);
  drawGrass(g, 470, 1150, 0.9);
  drawGrass(g, 660, 1240, 1.1);
  drawGrass(g, 60, 940, 0.8);
  drawStone(g, 236, 1180, 30);
  drawStone(g, 690, 1010, 26);
  drawStone(g, 96, 1268, 24);

  // 三个诱饵点的石台（火在画面上层点）
  for (const bait of level.mode === 'decoy' ? level.baits : []) {
    drawBaitSpot(g, bait.x, bait.y, false, false);
  }

  // 箱子的落脚处：一块空地的影子
  groundShadow(g, CHEST.x, CHEST.y + CHEST.h * 0.5, CHEST.w * 1.2, CHEST.h * 0.4, 0.2);
}

// ---------------- 每帧 ----------------

/** 守将此刻在哪儿：去诱饵点的路上 / 站在那儿看 / 往回走 */
function guardAt(
  level: Extract<LureLevel, { mode: 'decoy' }>,
  state: Extract<LureStageState, { mode: 'decoy' }>,
): { x: number; y: number; looking: boolean } {
  const post = level.guard;
  const bait = level.baits.find((item) => item.id === state.baitId);
  if (!state.away || bait === undefined || state.awayMs <= 0) {
    return { x: post.x, y: post.y, looking: false };
  }
  const p = 1 - state.awayLeftMs / state.awayMs; // 0 刚出发 → 1 回到岗位
  const out = Math.min(1, p / 0.3);
  const back = 1 - Math.max(0, Math.min(1, (p - 0.7) / 0.3));
  const k = Math.max(0, Math.min(out, back));
  return {
    x: post.x + (bait.x - post.x) * k,
    y: post.y + (bait.y - post.y) * k,
    looking: k > 0.6,
  };
}

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: LureStageState,
  level: LureLevel,
): void {
  if (state.mode !== 'decoy' || level.mode !== 'decoy') return;

  // 山那边：用过 / 正在用的诱饵点着了火，炊烟一直往上飘
  for (const bait of level.baits) {
    const used = state.usedBaits.includes(bait.id);
    const active = state.baitId === bait.id;
    if (!used) continue;
    drawBaitSpot(g, bait.x, bait.y, true, active);
    drawSmoke(g, bait.x, bait.y - 40, state.elapsedMs, active ? 0.55 : 0.34);
  }
  // 村里的灯火：山口一空，那边的灯就亮一片
  const lit = state.away || state.usedBaits.length > 0 ? 1 : 0.25;
  drawLight(g, HAMLET.x - 60, HAMLET.y + 4, 15, lit);
  drawLight(g, HAMLET.x + 56, HAMLET.y + 12, 13, lit * (state.away ? 1 : 0.6));
  drawSmoke(g, HAMLET.x - 46, HAMLET.y - 54, state.elapsedMs * 1.4, 0.3);

  // 箱子：按住的时候晃、往上抬一点 —— "正在搬走"
  if (!state.done) {
    const lift = state.holding && state.away ? 0.35 + state.grabRatio * 0.65 : state.grabRatio * 0.2;
    drawChest(g, CHEST.x, CHEST.y, 1, lift);
    if (state.holding && !state.away) {
      // 看守还在岗：箱子纹丝不动，只是晃一下门锁（白按，不惩罚）
      circle(g, CHEST.x, CHEST.y - 18, 15, THEME.paperDeep, THEME.outline, 5);
    }
  }

  // 守将
  const guard = guardAt(level, state);
  drawGuard(g, guard.x, guard.y, guard.y === level.guard.y ? 1 : 0.82, guard.looking);
}

/** 收尾：箱子搬走了，山口还空着，山那边的火还亮着 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: LureStageState,
  level: LureLevel,
): void {
  if (state.mode !== 'decoy' || level.mode !== 'decoy') return;
  g.fillStyle(THEME.gold, 0.16);
  g.fillEllipse(CHEST.x, CHEST.y + 10, 620, 420);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(CHEST.x, CHEST.y, 190);
  // 箱子在下山的路上（搬走了）
  drawChest(g, PATH[2]!.x + 40, PATH[2]!.y - 10, 0.8, 0);
  // 山口空着，守将还在山那边
  drawGuard(g, level.baits[1]!.x, level.baits[1]!.y + 20, 0.8, false);
}

// ---------------- 分幕插图 ----------------

/**
 * 分幕插图：① 守将站在山口，山那边静悄悄的
 * ② 山那边亮起来，守将过去看 —— 山口空了
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(DUSK, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle(WARM, 0.06 + i * 0.03);
    g.fillRect(x, y + h * 0.42 - i * 22, w, 26);
  }

  const ridgeY = y + h * 0.58;
  const passX = x + w / 2;
  // 山那边的小村
  g.fillStyle(HUT, 0.95);
  g.fillRect(passX - w * 0.34, ridgeY - h * 0.2, w * 0.16, h * 0.09);
  g.fillStyle(shade(HUT, 0.82), 1);
  g.fillTriangle(passX - w * 0.36, ridgeY - h * 0.2, passX - w * 0.16, ridgeY - h * 0.2, passX - w * 0.26, ridgeY - h * 0.28);
  g.fillRect(passX + w * 0.12, ridgeY - h * 0.17, w * 0.14, h * 0.08);
  g.fillTriangle(passX + w * 0.1, ridgeY - h * 0.17, passX + w * 0.28, ridgeY - h * 0.17, passX + w * 0.19, ridgeY - h * 0.25);
  const lit = index === 0 ? 0.2 : 1;
  drawLight(g, passX - w * 0.28, ridgeY - h * 0.14, 11, lit);
  drawLight(g, passX + w * 0.18, ridgeY - h * 0.12, 10, lit);
  drawLight(g, passX + w * 0.3, ridgeY - h * 0.06, 9, lit * 0.8);
  if (index > 0) {
    drawSmoke(g, passX - w * 0.26, ridgeY - h * 0.24, 1400, 0.5);
    drawSmoke(g, passX + w * 0.19, ridgeY - h * 0.2, 2600, 0.45);
  }

  // 近处的山脊：中间那个豁口就是山口
  g.fillStyle(ROCK, 1);
  g.beginPath();
  g.moveTo(x - 20, y + h);
  g.lineTo(x - 20, ridgeY + h * 0.2);
  g.lineTo(x + w * 0.18, ridgeY - h * 0.06);
  g.lineTo(x + w * 0.38, ridgeY - h * 0.16);
  g.lineTo(passX - w * 0.06, ridgeY - h * 0.02);
  g.lineTo(passX + w * 0.06, ridgeY - h * 0.02);
  g.lineTo(x + w * 0.62, ridgeY - h * 0.16);
  g.lineTo(x + w * 0.82, ridgeY - h * 0.06);
  g.lineTo(x + w + 20, ridgeY + h * 0.2);
  g.lineTo(x + w + 20, y + h);
  g.closePath();
  g.fillPath();

  // ① 守将站在豁口里（山口有人） ② 山口空了，人已经过去了
  if (index === 0) {
    drawGuard(g, passX, ridgeY + h * 0.02, 0.62, false);
  } else {
    g.fillStyle(ROCK_LIGHT, 0.6);
    g.fillRect(passX - 30, ridgeY + h * 0.02, 60, 10);
    drawGuard(g, passX - w * 0.26, ridgeY - h * 0.13, 0.5, true);
  }
}
