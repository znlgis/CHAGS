import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN, WAIT } from '@chags/templates';
import type { WaitLevel, WaitStageMetrics } from '@chags/templates';
import { clamp01 } from '@chags/game-kit';

/**
 * 太公钓鱼：一屏渭水。
 *
 * 全部用 Graphics 手绘，不引任何图片资源。整幅画分三层：
 * - drawWorld：天、远山、渭水、岸边的石头与白发老人。只画一次（点诱惑摇头、
 *   以及"他来了"时各重画一次），所以静态的东西都在这里。
 * - drawStage：每帧重画，只画会动的 —— 随 progress 从东到西的太阳与日影、
 *   天边一点点靠近的车马、水波与鱼群、底部三个诱惑按钮。
 * - drawFinale：收起直钩（放进竹筐）、周文王下车作揖、天色到位。
 *
 * ★ 签名画面：直钩悬在水面之上三尺 —— 鱼在下面游，永远咬不到。
 */

const W = DESIGN.width;
const H = DESIGN.height;
/** 标题条以下才是画面 */
const SKY_TOP = 150;
/** 水面：从这儿一直到画底 */
export const WATER_TOP = 624;
/** 远岸（山水相接的那一条） */
const BANK_TOP = 592;
const MOUNT_BASE = 614;
/** 岸边的石头：老人坐在上面 */
const ROCK = { x: 168, top: 706 };
/** 直钩：悬在水面之上三尺（钩底 568，水面 624）—— 中间是空的 */
const HOOK_X = 470;
const HOOK_TOP = 512;
const HOOK_LEN = 62;
/** 收钩的地方：竿倚在石头上的那一段 */
const FINALE = { x: 372, y: 606, radius: 132 };
/** 太阳从东走到西，走过的日影就是进度条 */
const SUN = { x0: 96, x1: 654, y: 440, rise: 200 };
/** 近岸的沙地：周文王的车马最后停在这里 */
const SAND = [
  { x: 130, y: 1132 },
  { x: 480, y: 948 },
  { x: 760, y: 880 },
] as const;

const SKIN = 0xf6d3ae;
const ROBE = 0x6f86b8;
const ROBE_DEEP = 0x54689a;
const HAIR = 0xf7f2e6;
const DAY_SKY = [0xa8dcf2, 0xc6e8f5, 0xe4f4f8] as const;
const DUSK_SKY = [0xf0be83, 0xf8d79c, 0xfdeac2] as const;
const DAY_WATER = [0x67b6de, 0x56a6d0, 0x4593bd] as const;
const DUSK_WATER = [0x76aec4, 0x6497b0, 0x53809c] as const;
const DAY_MOUNT = [0x9fd0b8, 0x7fc0a8] as const;
const DUSK_MOUNT = [0xc2a08c, 0xab8a78] as const;

/** 世界状态：等的时候坐着，人来了就站起来、把竿收在石头上 */
export interface WorldState {
  phase: 'wait' | 'arrived';
  /** 点诱惑时老人摇头：脑袋左右偏一下 */
  shake: number;
}

export interface StageOptions {
  /** 点到水面：鱼群散开一会儿（绝对时间戳） */
  scatterUntil?: number;
  /** 当前时刻（ctx.services.now()），与 scatterUntil 配对 */
  now?: number;
}


/** 在子坐标系里画东西：分幕插图直接复用玩法里的人物，不用再抄一遍 */
function withTransform(
  g: Phaser.GameObjects.Graphics,
  tx: number,
  ty: number,
  s: number,
  draw: () => void,
): void {
  g.save();
  g.translateCanvas(tx, ty);
  g.scaleCanvas(s, s);
  draw();
  g.restore();
}

// ---------------- 天与地 ----------------

function sky(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  const colors = dusk ? DUSK_SKY : DAY_SKY;
  const cuts = [SKY_TOP, 320, 470, WATER_TOP];
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(colors[i]!, 1);
    g.fillRect(0, cuts[i]!, W, cuts[i + 1]! - cuts[i]!);
  }
  if (dusk) {
    // 天边那一点落日的光
    g.fillStyle(0xffd08a, 0.5);
    g.fillEllipse(560, WATER_TOP - 30, 420, 130);
  }
}

function mountains(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  const colors = dusk ? DUSK_MOUNT : DAY_MOUNT;
  g.fillStyle(colors[0]!, 1);
  g.fillTriangle(-40, MOUNT_BASE, 190, 452, 430, MOUNT_BASE);
  g.lineStyle(6, THEME.outline, 0.5);
  g.strokeTriangle(-40, MOUNT_BASE, 190, 452, 430, MOUNT_BASE);
  g.fillStyle(colors[1]!, 1);
  g.fillTriangle(300, MOUNT_BASE, 545, 490, 790, MOUNT_BASE);
  g.lineStyle(6, THEME.outline, 0.5);
  g.strokeTriangle(300, MOUNT_BASE, 545, 490, 790, MOUNT_BASE);
}

/** 远岸：山脚到水面之间的那一条土黄，天边的车马走在上面 */
function farBank(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  g.fillStyle(dusk ? 0xe3bd88 : THEME.sandDeep, 1);
  g.fillRect(0, BANK_TOP, W, WATER_TOP - BANK_TOP + 4);
  g.lineStyle(5, THEME.outline, 0.35);
  g.lineBetween(0, BANK_TOP, W, BANK_TOP);
  // 岸上的几棵小树（天边那几棵）
  for (let i = 0; i < 5; i += 1) {
    const tx = 60 + i * 78;
    g.fillStyle(0x8a6a2f, 1);
    g.fillRect(tx - 3, BANK_TOP - 26, 7, 28);
    g.fillStyle(dusk ? 0x9a8060 : 0x74b96c, 1);
    g.fillCircle(tx, BANK_TOP - 34, 15);
  }
}

function water(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  const colors = dusk ? DUSK_WATER : DAY_WATER;
  const cuts = [WATER_TOP, 800, 1010, H];
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(colors[i]!, 1);
    g.fillRect(0, cuts[i]!, W, cuts[i + 1]! - cuts[i]!);
  }
  // 水面上那一道亮边
  g.fillStyle(0xffffff, dusk ? 0.3 : 0.45);
  g.fillRect(0, WATER_TOP, W, 5);
}

/** 岸边的石头：老人的座位 */
function rock(g: Phaser.GameObjects.Graphics): void {
  const { x, top } = ROCK;
  g.fillStyle(THEME.stoneDeep, 1);
  g.beginPath();
  g.moveTo(x - 156, top + 26);
  g.lineTo(x - 108, top + 300);
  g.lineTo(x + 140, top + 326);
  g.lineTo(x + 162, top + 30);
  g.closePath();
  g.fillPath();
  g.fillStyle(THEME.stone, 1);
  g.beginPath();
  g.moveTo(x - 156, top + 26);
  g.lineTo(x - 92, top - 8);
  g.lineTo(x + 62, top - 12);
  g.lineTo(x + 162, top + 30);
  g.lineTo(x + 116, top + 150);
  g.lineTo(x - 122, top + 140);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  // 石缝
  g.lineStyle(4, THEME.stoneDeep, 1);
  g.lineBetween(x - 60, top + 10, x - 20, top + 108);
  g.lineBetween(x + 40, top + 4, x + 66, top + 96);
}

// ---------------- 白发老人 ----------------

/** 白头发、白胡子、青灰衣裳：一眼看出是位老人 */
function oldHead(
  g: Phaser.GameObjects.Graphics,
  hx: number,
  hy: number,
  r: number,
  shake: number,
  awake: boolean,
): void {
  const cx = hx + shake;
  circle(g, cx, hy, r, SKIN, THEME.outline, 6);
  g.fillStyle(HAIR, 1);
  g.beginPath();
  g.arc(cx, hy, r - 2, Math.PI * 1.02, Math.PI * 1.98, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.beginPath();
  g.arc(cx, hy, r - 2, Math.PI * 1.02, Math.PI * 1.98, false);
  g.strokePath();
  circle(g, cx, hy - r - 8, r * 0.3, HAIR, THEME.outline, 5);
  // 长须
  g.fillStyle(HAIR, 1);
  g.beginPath();
  g.moveTo(cx - r * 0.56, hy + r * 0.36);
  g.lineTo(cx + r * 0.56, hy + r * 0.36);
  g.lineTo(cx + r * 0.28, hy + r * 1.5);
  g.lineTo(cx - r * 0.28, hy + r * 1.5);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, THEME.outline, 1);
  g.strokePath();
  // 眉与眼：等久了也不焦躁的一双眼
  g.lineStyle(7, HAIR, 1);
  g.lineBetween(cx - r * 0.62, hy - r * 0.5, cx - r * 0.16, hy - r * 0.56);
  g.lineBetween(cx + r * 0.16, hy - r * 0.56, cx + r * 0.62, hy - r * 0.5);
  g.lineStyle(5, THEME.outline, 1);
  if (awake) {
    g.fillStyle(THEME.outline, 1);
    g.fillCircle(cx - r * 0.34, hy - r * 0.1, r * 0.1);
    g.fillCircle(cx + r * 0.34, hy - r * 0.1, r * 0.1);
  } else {
    g.lineBetween(cx - r * 0.5, hy - r * 0.1, cx - r * 0.16, hy - r * 0.1);
    g.lineBetween(cx + r * 0.16, hy - r * 0.1, cx + r * 0.5, hy - r * 0.1);
  }
  // 嘴角
  g.beginPath();
  g.arc(cx, hy + r * 0.34, r * 0.2, Math.PI * 0.18, Math.PI * 0.82, false);
  g.strokePath();
}

/** 鱼竿、鱼线，以及那枚直钩（画在手上，所以单独一个函数） */
function rig(
  g: Phaser.GameObjects.Graphics,
  handX: number,
  handY: number,
  tipX: number,
  tipY: number,
): void {
  g.lineStyle(12, THEME.outline, 1);
  g.lineBetween(handX, handY, tipX, tipY);
  g.lineStyle(7, THEME.wood, 1);
  g.lineBetween(handX, handY, tipX, tipY);
  const hookTop = tipY + 56;
  g.lineStyle(3, 0x5b6b7a, 0.9);
  g.lineBetween(tipX, tipY, tipX, hookTop);
  straightHook(g, tipX, hookTop);
}

/** 直钩：一根笔直的针，没有弯，也没有饵 */
export function straightHook(g: Phaser.GameObjects.Graphics, x: number, top: number): void {
  const bottom = top + HOOK_LEN;
  g.lineStyle(11, 0xe8edf2, 1);
  g.lineBetween(x, top, x, bottom);
  g.lineStyle(5, 0x6b7a88, 1);
  g.lineBetween(x, top, x, bottom);
  g.fillStyle(0xe8edf2, 1);
  g.fillTriangle(x - 13, bottom - 18, x + 13, bottom - 18, x, bottom + 3);
  g.lineStyle(4, 0x6b7a88, 1);
  g.beginPath();
  g.moveTo(x - 13, bottom - 18);
  g.lineTo(x, bottom + 3);
  g.lineTo(x + 13, bottom - 18);
  g.strokePath();
  // 系线的小红结
  circle(g, x, top - 2, 7, THEME.red, THEME.outline, 3);
}

/**
 * 直钩到水面之间那一段空 —— "离水三尺"是这则典故的签名，
 * 所以把它画成一道看得见的尺寸线（上下两个小箭头 + 虚线），
 * 孩子一眼就知道：钩根本没有碰到水。
 */
function gapMark(g: Phaser.GameObjects.Graphics): void {
  const top = HOOK_TOP + HOOK_LEN + 8;
  const bottom = WATER_TOP - 8;
  g.lineStyle(5, 0xffffff, 0.8);
  for (let y = top + 16; y < bottom - 20; y += 20) {
    g.lineBetween(HOOK_X, y, HOOK_X, y + 11);
  }
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(HOOK_X - 13, top + 14, HOOK_X + 13, top + 14, HOOK_X, top);
  g.fillTriangle(HOOK_X - 13, bottom - 14, HOOK_X + 13, bottom - 14, HOOK_X, bottom);
}

/** 坐着等：盘腿、一只手扶着竿、一只手搭在膝上 */
function oldManBody(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  seatY: number,
  shake: number,
): void {
  groundShadow(g, cx + 10, seatY + 8, 200, 32, 0.16);
  roundRect(g, cx - 36, seatY - 42, 154, 46, 22, ROBE_DEEP, THEME.outline, 6);
  roundRect(g, cx + 92, seatY - 38, 50, 30, 14, 0x8a6a2f, THEME.outline, 6);
  g.fillStyle(ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 58, seatY - 34);
  g.lineTo(cx + 28, seatY - 46);
  g.lineTo(cx + 22, seatY - 150);
  g.lineTo(cx - 50, seatY - 142);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  // 扶着竿的那只手
  g.lineStyle(20, ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 8, seatY - 132);
  g.lineTo(cx + 78, seatY - 148);
  g.strokePath();
  circle(g, cx + 84, seatY - 150, 16, SKIN, THEME.outline, 5);
  // 搭在膝上的那只手
  g.lineStyle(20, ROBE_DEEP, 1);
  g.beginPath();
  g.moveTo(cx - 14, seatY - 118);
  g.lineTo(cx + 24, seatY - 62);
  g.strokePath();
  circle(g, cx + 28, seatY - 56, 14, SKIN, THEME.outline, 5);
  oldHead(g, cx - 6, seatY - 186, 44, shake, false);
}

/** 站起来：等的人到了，就该站起来了 */
function oldManStanding(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  shake: number,
): void {
  groundShadow(g, cx, baseY + 8, 160, 30, 0.2);
  roundRect(g, cx - 54, baseY - 32, 48, 32, 15, 0x8a6a2f, THEME.outline, 6);
  roundRect(g, cx + 6, baseY - 32, 48, 32, 15, 0x8a6a2f, THEME.outline, 6);
  g.fillStyle(ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 48, baseY - 40);
  g.lineTo(cx + 48, baseY - 40);
  g.lineTo(cx + 36, baseY - 186);
  g.lineTo(cx - 36, baseY - 186);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(ROBE_DEEP, 1);
  g.fillRect(cx - 42, baseY - 116, 84, 16);
  // 一只手抬起来迎客，一只手垂着
  g.lineStyle(19, ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 30, baseY - 168);
  g.lineTo(cx - 72, baseY - 104);
  g.strokePath();
  circle(g, cx - 76, baseY - 98, 15, SKIN, THEME.outline, 5);
  g.lineStyle(19, ROBE, 1);
  g.beginPath();
  g.moveTo(cx + 30, baseY - 168);
  g.lineTo(cx + 74, baseY - 196);
  g.strokePath();
  circle(g, cx + 78, baseY - 200, 15, SKIN, THEME.outline, 5);
  oldHead(g, cx, baseY - 218, 43, shake, true);
}

/** 收在石头上的竿与线团：等到了，直钩就该收起来 */
function stowedRod(g: Phaser.GameObjects.Graphics): void {
  const top = ROCK.top;
  g.lineStyle(12, THEME.outline, 1);
  g.lineBetween(300, top - 4, 374, top - 210);
  g.lineStyle(7, THEME.wood, 1);
  g.lineBetween(300, top - 4, 374, top - 210);
  // 线团
  g.lineStyle(4, 0xe4ebf1, 1);
  g.strokeCircle(328, top - 24, 23);
  g.strokeCircle(334, top - 30, 14);
  // 直钩躺在线团上
  g.lineStyle(9, 0xd8dde2, 1);
  g.lineBetween(306, top - 16, 356, top - 34);
  g.lineStyle(4, 0x6b7a88, 1);
  g.lineBetween(306, top - 16, 356, top - 34);
  g.fillStyle(0xe8edf2, 1);
  g.fillTriangle(356, top - 34, 344, top - 40, 348, top - 24);
}

/** 竹筐：直钩最后收进这里 */
function basket(g: Phaser.GameObjects.Graphics, cx: number, baseY: number): void {
  const w = 78;
  g.fillStyle(0xdcb26a, 1);
  g.beginPath();
  g.moveTo(cx - w, baseY - 118);
  g.lineTo(cx + w, baseY - 118);
  g.lineTo(cx + w * 0.72, baseY);
  g.lineTo(cx - w * 0.72, baseY);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.woodDeep, 1);
  g.strokePath();
  g.lineStyle(4, shade(THEME.woodDeep, 1.15), 1);
  for (let i = 1; i < 4; i += 1) {
    const y = baseY - 118 + i * 30;
    const half = w * (1 - i * 0.07);
    g.lineBetween(cx - half, y, cx + half, y);
  }
  // 筐口
  roundRect(g, cx - w - 6, baseY - 130, w * 2 + 12, 22, 11, 0xe8c48a, THEME.woodDeep, 5);
  // 直钩露在筐口外
  g.lineStyle(10, 0xe8edf2, 1);
  g.lineBetween(cx + 30, baseY - 128, cx - 8, baseY - 186);
  g.lineStyle(5, 0x6b7a88, 1);
  g.lineBetween(cx + 30, baseY - 128, cx - 8, baseY - 186);
  g.fillStyle(0xe8edf2, 1);
  g.fillTriangle(cx - 8, baseY - 186, cx - 20, baseY - 168, cx + 4, baseY - 172);
}

// ---------------- 鱼、水波、云 ----------------

function fish(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  dir: number,
  color: number,
): void {
  const d = dir >= 0 ? 1 : -1;
  const bw = 48 * s;
  const bh = 26 * s;
  g.fillStyle(shade(color, 0.82), 1);
  g.fillTriangle(x - d * bw * 0.5, y, x - d * (bw * 0.5 + 22 * s), y - 15 * s, x - d * (bw * 0.5 + 22 * s), y + 15 * s);
  g.lineStyle(4, THEME.outline, 0.9);
  g.beginPath();
  g.moveTo(x - d * bw * 0.5, y);
  g.lineTo(x - d * (bw * 0.5 + 22 * s), y - 15 * s);
  g.lineTo(x - d * (bw * 0.5 + 22 * s), y + 15 * s);
  g.closePath();
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, bw, bh);
  g.lineStyle(4, THEME.outline, 0.9);
  g.strokeEllipse(x, y, bw, bh);
  // 背鳍
  g.fillStyle(shade(color, 0.78), 1);
  g.fillTriangle(x - d * 4 * s, y - bh * 0.44, x + d * 16 * s, y - bh * 0.44, x + d * 6 * s, y - bh * 1.1);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + d * bw * 0.3, y - 3 * s, 3.6 * s);
}

function waveLine(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y: number,
  w: number,
  amp: number,
  phase: number,
  width: number,
  color: number,
  alpha: number,
): void {
  const segments = 24;
  g.lineStyle(width, color, alpha);
  g.beginPath();
  for (let i = 0; i <= segments; i += 1) {
    const px = x0 + (w * i) / segments;
    const py = y + Math.sin(phase + (i / segments) * Math.PI * 2.4) * amp;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha: number): void {
  g.fillStyle(0xffffff, alpha);
  g.fillEllipse(x, y, 150 * s, 52 * s);
  g.fillCircle(x - 48 * s, y - 12 * s, 32 * s);
  g.fillCircle(x + 4 * s, y - 26 * s, 40 * s);
  g.fillCircle(x + 54 * s, y - 10 * s, 28 * s);
}

// ---------------- 车马与周文王 ----------------

function horse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  s: number,
): void {
  const u = (v: number): number => v * s;
  g.lineStyle(u(12), 0x8a6a3c, 1);
  for (const dx of [-30, -8, 14, 34]) {
    g.lineBetween(x + u(dx), baseY - u(44), x + u(dx), baseY);
  }
  g.fillStyle(0xb08454, 1);
  g.fillEllipse(x, baseY - u(64), u(100), u(56));
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokeEllipse(x, baseY - u(64), u(100), u(56));
  g.fillStyle(0xb08454, 1);
  g.beginPath();
  g.moveTo(x - u(40), baseY - u(84));
  g.lineTo(x - u(74), baseY - u(120));
  g.lineTo(x - u(92), baseY - u(104));
  g.lineTo(x - u(54), baseY - u(62));
  g.closePath();
  g.fillPath();
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokePath();
  g.fillStyle(0xb08454, 1);
  g.fillEllipse(x - u(88), baseY - u(114), u(48), u(28));
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokeEllipse(x - u(88), baseY - u(114), u(48), u(28));
  g.fillStyle(0x6b4a2a, 1);
  g.fillTriangle(x - u(52), baseY - u(122), x - u(70), baseY - u(136), x - u(44), baseY - u(74));
  g.lineStyle(u(10), 0x6b4a2a, 1);
  g.beginPath();
  g.moveTo(x + u(48), baseY - u(78));
  g.lineTo(x + u(72), baseY - u(34));
  g.strokePath();
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - u(100), baseY - u(122), u(4));
}

function cart(g: Phaser.GameObjects.Graphics, x: number, baseY: number, s: number): void {
  const u = (v: number): number => v * s;
  g.lineStyle(u(8), THEME.woodDeep, 1);
  g.lineBetween(x - u(60), baseY - u(44), x - u(172), baseY - u(56));
  for (const dx of [-38, 38]) {
    circle(g, x + u(dx), baseY - u(20), u(26), shade(THEME.wood, 0.72), THEME.outline, u(5));
    g.lineStyle(u(4), THEME.woodDeep, 1);
    g.strokeCircle(x + u(dx), baseY - u(20), u(11));
  }
  g.fillStyle(THEME.red, 1);
  g.beginPath();
  g.moveTo(x - u(78), baseY - u(92));
  g.lineTo(x + u(78), baseY - u(92));
  g.lineTo(x + u(60), baseY - u(166));
  g.lineTo(x - u(60), baseY - u(166));
  g.closePath();
  g.fillPath();
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokePath();
  g.lineStyle(u(4), shade(THEME.red, 0.7), 1);
  g.lineBetween(x - u(68), baseY - u(120), x + u(68), baseY - u(120));
  roundRect(g, x - u(30), baseY - u(88), u(60), u(52), u(10), 0x7c4a24, THEME.outline, u(4));
  // 拉着车的那根辕
  g.lineStyle(u(7), THEME.woodDeep, 1);
  g.lineBetween(x + u(60), baseY - u(86), x + u(160), baseY - u(70));
}

/** 车马：马在前，车在后，一起从东边来 */
function carriage(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, s: number): void {
  cart(g, cx, baseY, s);
  horse(g, cx + 118 * s, baseY, s);
}

/** 周文王：作揖请他上车 */
function king(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, s: number): void {
  const u = (v: number): number => v * s;
  groundShadow(g, cx, baseY + u(6), u(180), u(28), 0.22);
  g.fillStyle(0xd8a24a, 1);
  g.beginPath();
  g.moveTo(cx - u(58), baseY);
  g.lineTo(cx + u(58), baseY);
  g.lineTo(cx + u(42), baseY - u(168));
  g.lineTo(cx - u(42), baseY - u(168));
  g.closePath();
  g.fillPath();
  g.lineStyle(u(6), THEME.outline, 1);
  g.strokePath();
  g.fillStyle(0x8c4a3f, 1);
  g.fillRect(cx - u(46), baseY - u(112), u(92), u(16));
  // 双手抱拳，向前一揖
  const handX = cx - u(74);
  const handY = baseY - u(126);
  g.lineStyle(u(18), 0xd8a24a, 1);
  g.beginPath();
  g.moveTo(cx - u(20), baseY - u(152));
  g.lineTo(handX, handY);
  g.strokePath();
  circle(g, handX, handY, u(21), SKIN, THEME.outline, u(5));
  const hx = cx - u(18);
  const hy = baseY - u(206);
  circle(g, hx, hy, u(38), SKIN, THEME.outline, u(6));
  // 冠
  g.fillStyle(0x4a4a6a, 1);
  g.fillRect(hx - u(34), hy - u(50), u(68), u(24));
  g.fillRect(hx - u(20), hy - u(70), u(40), u(24));
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokeRect(hx - u(34), hy - u(50), u(68), u(24));
  g.strokeRect(hx - u(20), hy - u(70), u(40), u(24));
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(hx - u(13), hy - u(4), u(5));
  g.fillCircle(hx + u(13), hy - u(4), u(5));
  g.lineStyle(u(5), THEME.outline, 1);
  g.beginPath();
  g.arc(hx, hy + u(16), u(12), Math.PI * 0.15, Math.PI * 0.85, false);
  g.strokePath();
}

/** 近岸的沙地：车马就停在这儿 */
function sandEdge(x: number): number {
  for (let i = 1; i < SAND.length; i += 1) {
    const a = SAND[i - 1]!;
    const b = SAND[i]!;
    if (x <= b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return SAND[SAND.length - 1]!.y;
}

function sandBank(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  g.fillStyle(dusk ? 0xe9cfa0 : THEME.sand, 1);
  g.beginPath();
  g.moveTo(SAND[0]!.x, SAND[0]!.y);
  for (let i = 1; i < SAND.length; i += 1) g.lineTo(SAND[i]!.x, SAND[i]!.y);
  g.lineTo(W, H);
  g.lineTo(SAND[0]!.x, H);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.sandDeep, 1);
  g.beginPath();
  g.moveTo(SAND[0]!.x, SAND[0]!.y);
  for (let i = 1; i < SAND.length; i += 1) g.lineTo(SAND[i]!.x, SAND[i]!.y);
  g.strokePath();
  // 岸上的几块小石头
  for (const [sx, ssize] of [[250, 16], [360, 12], [640, 14]] as const) {
    const sy = sandEdge(sx) + 46;
    circle(g, sx, sy, ssize, THEME.stone, THEME.stoneDeep, 4);
  }
}

/** 他来了：文王下车作揖，请他上车 */
function meetup(g: Phaser.GameObjects.Graphics, dusk: boolean): void {
  sandBank(g, dusk);
  const cartY = sandEdge(600) - 6;
  carriage(g, 600, cartY, 0.72);
  const kingY = sandEdge(400) - 4;
  king(g, 400, kingY, 0.9);
  // 一路金光，从文王脚下铺到车门
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle(THEME.gold, 0.55 + i * 0.06);
    g.fillCircle(470 + i * 18, kingY + 30 - Math.sin(i) * 14, 9 - i * 0.7);
  }
}

// ---------------- 世界 ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, state: WorldState): void {
  const dusk = state.phase === 'arrived';
  sky(g, dusk);
  mountains(g, dusk);
  farBank(g, dusk);
  water(g, dusk);
  rock(g);
  if (dusk) {
    stowedRod(g);
    oldManStanding(g, ROCK.x - 18, ROCK.top, state.shake);
  } else {
    // 签名画面：鱼竿伸向水面，直钩悬在水面之上三尺
    oldManBody(g, ROCK.x, ROCK.top, state.shake);
    rig(g, ROCK.x + 84, ROCK.top - 150, HOOK_X, HOOK_TOP - 56);
    gapMark(g);
  }
}

// ---------------- 每帧重画的那一层 ----------------

function sunAndTrail(g: Phaser.GameObjects.Graphics, p: number): void {
  const at = (t: number): { x: number; y: number } => ({
    x: SUN.x0 + (SUN.x1 - SUN.x0) * t,
    y: SUN.y - Math.sin(Math.PI * clamp01(t)) * SUN.rise,
  });
  const segs = 26;
  for (let i = 0; i < segs; i += 1) {
    const a = at(i / segs);
    const b = at((i + 1) / segs);
    const walked = (i + 1) / segs <= p + 1e-6;
    g.lineStyle(walked ? 8 : 4, walked ? THEME.gold : 0xffffff, walked ? 0.85 : 0.5);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  const s = at(p);
  g.fillStyle(THEME.gold, 0.22);
  g.fillCircle(s.x, s.y, 68);
  g.lineStyle(5, THEME.goldDeep, 0.9);
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    g.lineBetween(
      s.x + Math.cos(a) * 52, s.y + Math.sin(a) * 52,
      s.x + Math.cos(a) * 68, s.y + Math.sin(a) * 68,
    );
  }
  circle(g, s.x, s.y, 40, THEME.gold, THEME.outline, 5);
}

function clouds(g: Phaser.GameObjects.Graphics, elapsedMs: number): void {
  const drift = elapsedMs * 0.012;
  for (const [base, y, s, alpha] of [[60, 232, 1, 0.85], [330, 300, 0.72, 0.7], [520, 208, 0.6, 0.6]] as const) {
    const x = ((base + drift) % (W + 320)) - 160;
    cloud(g, x, y, s, alpha);
  }
}

function ripples(g: Phaser.GameObjects.Graphics, elapsedMs: number): void {
  const phase = elapsedMs / 900;
  for (let i = 0; i < 4; i += 1) {
    waveLine(g, 330, 668 + i * 96, 430, 5 + i, phase + i * 1.3, 5, 0xffffff, 0.34 - i * 0.05);
  }
  waveLine(g, 340, 720, 400, 4, -phase * 1.4, 4, THEME.waterDeep, 0.35);
  waveLine(g, 360, 880, 380, 6, phase * 0.8, 4, THEME.waterDeep, 0.28);
}

const FISH = [
  { y: 690, s: 0.9, speed: 0.000075, dir: 1, color: THEME.gold, phase: 0 },
  { y: 742, s: 0.7, speed: 0.000098, dir: -1, color: 0xe08a4a, phase: 0.3 },
  { y: 800, s: 1.05, speed: 0.000062, dir: 1, color: 0xf07a5a, phase: 0.62 },
  { y: 862, s: 0.8, speed: 0.00011, dir: -1, color: 0x7fc9c0, phase: 0.18 },
  { y: 920, s: 0.95, speed: 0.00007, dir: 1, color: THEME.gold, phase: 0.78 },
  { y: 976, s: 0.72, speed: 0.00012, dir: -1, color: 0xe08a4a, phase: 0.45 },
  { y: 1024, s: 0.88, speed: 0.000085, dir: 1, color: 0x7fc9c0, phase: 0.9 },
] as const;

function fishSchool(
  g: Phaser.GameObjects.Graphics,
  elapsedMs: number,
  scatter: boolean,
  arrived: boolean,
): void {
  FISH.forEach((f, i) => {
    const t = (((elapsedMs * f.speed + f.phase) % 1) + 1) % 1;
    const lane = arrived ? 300 : 380;
    const x = (f.dir > 0 ? 356 + t * lane : 736 - t * lane) + (scatter ? f.dir * 44 : 0);
    const bob = Math.sin(elapsedMs / 460 + i * 1.7) * (scatter ? 20 : 8);
    fish(g, x, f.y + bob, f.s, f.dir, f.color);
  });
}

function temptationIcon(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
  s: number,
  alpha = 1,
): void {
  if (kind === 'bend') {
    // 弯钩：和那根直钩正好相反
    g.lineStyle(11 * s, 0xe8edf2, alpha);
    g.beginPath();
    g.arc(x + 6 * s, y + 2 * s, 24 * s, Math.PI * 1.05, Math.PI * 2.35, false);
    g.strokePath();
    g.lineStyle(5 * s, 0x6b7a88, alpha);
    g.beginPath();
    g.arc(x + 6 * s, y + 2 * s, 24 * s, Math.PI * 1.05, Math.PI * 2.35, false);
    g.strokePath();
    g.lineStyle(6 * s, 0x8a94a0, alpha);
    g.lineBetween(x + 8 * s, y - 20 * s, x + 10 * s, y - 40 * s);
    circle(g, x + 10 * s, y - 46 * s, 8 * s, THEME.card, THEME.outline, 4 * s);
    g.fillStyle(0xe8edf2, alpha);
    g.fillTriangle(x - 16 * s, y + 22 * s, x + 2 * s, y + 24 * s, x - 6 * s, y + 40 * s);
    return;
  }
  if (kind === 'bait') {
    // 鱼饵：一团面团 + 一条扭来扭去的蚯蚓
    circle(g, x, y + 8 * s, 26 * s, 0xd7a86a, THEME.woodDeep, 5 * s, alpha);
    g.lineStyle(11 * s, 0xc2604f, alpha);
    g.beginPath();
    g.moveTo(x - 22 * s, y - 8 * s);
    g.lineTo(x - 6 * s, y - 26 * s);
    g.lineTo(x + 12 * s, y - 12 * s);
    g.lineTo(x + 24 * s, y - 30 * s);
    g.strokePath();
    g.fillStyle(0x6b3a30, alpha);
    g.fillCircle(x + 24 * s, y - 32 * s, 5 * s);
    g.fillStyle(0x8a5a3a, alpha);
    g.fillCircle(x - 8 * s, y + 8 * s, 4 * s);
    g.fillCircle(x + 10 * s, y + 16 * s, 4 * s);
    return;
  }
  // 换地方：一块指路的木牌
  g.lineStyle(11 * s, THEME.woodDeep, alpha);
  g.lineBetween(x - 6 * s, y + 40 * s, x - 6 * s, y - 18 * s);
  g.fillStyle(0xd7a86a, alpha);
  g.beginPath();
  g.moveTo(x - 40 * s, y - 42 * s);
  g.lineTo(x + 26 * s, y - 42 * s);
  g.lineTo(x + 44 * s, y - 24 * s);
  g.lineTo(x + 26 * s, y - 6 * s);
  g.lineTo(x - 40 * s, y - 6 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.woodDeep, alpha);
  g.strokePath();
  g.fillStyle(0x8a5a3a, alpha);
  g.fillEllipse(x - 14 * s, y + 30 * s, 26 * s, 16 * s);
  g.fillEllipse(x + 6 * s, y + 40 * s, 26 * s, 16 * s);
}

/** 诱惑按钮（画在底部一排）：点了就得多等一会儿 */
function temptations(
  g: Phaser.GameObjects.Graphics,
  level: WaitLevel,
  hits: number,
  elapsedMs: number,
): void {
  const r = WAIT.temptationRadius - 16;
  level.temptations.forEach((t, i) => {
    const spent = hits >= level.penaltyCap;
    const pulse = 0.5 + 0.5 * Math.sin(elapsedMs / 620 + i * 1.9);
    if (!spent) {
      g.fillStyle(THEME.gold, 0.12 + 0.12 * pulse);
      g.fillCircle(t.x, t.y, r + 20 + 6 * pulse);
    }
    g.fillStyle(shade(THEME.card, 0.78), 1);
    g.fillCircle(t.x, t.y + 10, r);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(t.x, t.y + 10, r);
    g.fillStyle(spent ? 0xe6e0d4 : THEME.card, 1);
    g.fillCircle(t.x, t.y, r);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(t.x, t.y, r);
    temptationIcon(g, t.kind, t.x, t.y, spent ? 0.85 : 1, spent ? 0.45 : 1);
  });
}

/** 点诱惑时老人手里冒出来的那个东西（画在原点，交给 index.ts 摆位置） */
export function drawTemptationItem(g: Phaser.GameObjects.Graphics, kind: string): void {
  temptationIcon(g, kind, 0, 0, 1.15);
}

/** 天边极远处的车马：随 progress 一点点靠近 */
function farCarriage(g: Phaser.GameObjects.Graphics, p: number): void {
  const t = clamp01(p);
  carriage(g, 700 - 140 * t, WATER_TOP - 4, 0.3 + 0.2 * t);
}

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  level: WaitLevel,
  metrics: WaitStageMetrics,
  opts: StageOptions = {},
): void {
  const p = clamp01(metrics.progress);
  const scatter =
    opts.now !== undefined && opts.scatterUntil !== undefined && opts.now < opts.scatterUntil;
  ripples(g, metrics.elapsedMs);
  sunAndTrail(g, p);
  clouds(g, metrics.elapsedMs);
  if (!metrics.arrived) farCarriage(g, p);
  fishSchool(g, metrics.elapsedMs, scatter, metrics.arrived);
  if (metrics.arrived) meetup(g, true);
  else temptations(g, level, metrics.hits, metrics.elapsedMs);
}

/** 收钩：直钩收进竹筐，天色到位 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffd08a, 0.16);
  g.fillRect(0, SKY_TOP, W, WATER_TOP - SKY_TOP);
  g.fillStyle(0xffe6b8, 0.12);
  g.fillRect(0, WATER_TOP, W, H - WATER_TOP);
  // 一束光落在石头上
  g.fillStyle(0xfff3d0, 0.2);
  g.beginPath();
  g.moveTo(268, SKY_TOP);
  g.lineTo(430, SKY_TOP);
  g.lineTo(372, 780);
  g.closePath();
  g.fillPath();
  basket(g, FINALE.x - 24, ROCK.top + 4);
  meetup(g, true);
}

/** 分幕插图：一幕"没有人用他"，一幕"愿者上钩" */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  const skyColor = index === 0 ? 0xdff0f8 : 0xd6ecf6;
  g.fillStyle(skyColor, 1);
  g.fillRoundedRect(x, y, w, h, 34);

  if (index === 0) {
    // 没有人用他：田边，老人一个人坐着，两个路人从他身边走过去
    g.fillStyle(0xbfe3a4, 1);
    g.fillRect(x + 6, y + h - 240, w - 12, 234);
    g.fillStyle(0xa8d78f, 1);
    g.fillRect(x + 6, y + h - 120, w - 12, 114);
    g.fillStyle(0x9fd0b8, 1);
    g.fillTriangle(x + 16, y + h - 240, x + 180, y + 130, x + 344, y + h - 240);
    g.fillStyle(0x7fc0a8, 1);
    g.fillTriangle(x + 300, y + h - 240, x + 470, y + 160, x + w - 8, y + h - 240);
    // 一棵树
    g.fillStyle(0x8a6a2f, 1);
    g.fillRect(x + 548, y + h - 330, 22, 96);
    g.fillStyle(0x74b96c, 1);
    g.fillCircle(x + 558, y + h - 360, 74);
    g.fillCircle(x + 500, y + h - 320, 52);
    g.fillCircle(x + 612, y + h - 318, 50);
    // 石头与老人
    circle(g, x + 196, y + h - 240, 74, THEME.stone, THEME.outline, 6);
    withTransform(g, x + 196, y + h - 244, 0.62, () => oldManBody(g, 0, 0, 0));
    // 他身边的一只竹篓
    roundRect(g, x + 236, y + h - 276, 62, 44, 14, 0xdcb26a, THEME.woodDeep, 5);
    // 两个走开的人（背对着他）
    villager(g, x + 430, y + h - 236, 0.86, 0x7c9ac0, true, false);
    villager(g, x + 512, y + h - 236, 0.92, 0x9a7ab0, true, false);
    // 一声没人听见的叹气
    g.fillStyle(THEME.card, 1);
    g.fillCircle(x + 116, y + 168, 52);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeCircle(x + 116, y + 168, 52);
    g.fillTriangle(x + 142, y + 210, x + 180, y + 258, x + 120, y + 216);
    g.fillStyle(THEME.inkSoft, 1);
    for (let i = 0; i < 3; i += 1) g.fillCircle(x + 86 + i * 30, y + 168, 8);
    return;
  }

  // 愿者上钩：渭水边，钩是直的，鱼在下面游
  g.fillStyle(0x9fd0b8, 1);
  g.fillTriangle(x + 10, y + h - 300, x + 210, y + 120, x + 420, y + h - 300);
  g.fillStyle(0x7fc0a8, 1);
  g.fillTriangle(x + 320, y + h - 300, x + 500, y + 150, x + w - 8, y + h - 300);
  const wy = y + h - 320;
  g.fillStyle(0x67b6de, 1);
  g.fillRect(x + 6, wy, w - 12, 216);
  g.fillStyle(0x56a6d0, 1);
  g.fillRect(x + 6, wy + 108, w - 12, 108);
  g.fillStyle(0xffffff, 0.4);
  g.fillRect(x + 6, wy, w - 12, 5);
  // 近岸的沙地：岸上看热闹的人站在这儿，不是站在水里
  g.fillStyle(THEME.sand, 1);
  g.fillRoundedRect(x + 6, y + h - 104, w - 12, 98, { tl: 0, tr: 0, bl: 34, br: 34 });
  // 岸边的石头与老人
  circle(g, x + 168, wy + 30, 82, THEME.stone, THEME.outline, 6);
  withTransform(g, x + 168, wy + 22, 0.55, () => {
    oldManBody(g, 0, 0, 0);
    rig(g, 84, -150, 236, -272);
  });
  // 水下的鱼：钩在上面，它们够不着
  fish(g, x + 300, wy + 132, 1.05, -1, THEME.gold);
  fish(g, x + 424, wy + 176, 0.8, 1, 0x7fc9c0);
  // 岸上看热闹的人（在笑他）
  villager(g, x + 540, y + h - 110, 0.95, 0x8f9bb3, false, true);
  // 老人的回答，画在气泡里：就是那根直钩
  g.fillStyle(THEME.card, 1);
  g.fillCircle(x + 322, y + 176, 58);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(x + 322, y + 176, 58);
  g.fillTriangle(x + 288, y + 226, x + 300, y + 274, x + 320, y + 228);
  withTransform(g, x + 322, y + 158, 0.62, () => straightHook(g, 0, 0));
}

/** 走开的路人 / 看热闹的人 */
function villager(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  s: number,
  robe: number,
  back: boolean,
  laughing: boolean,
): void {
  const u = (v: number): number => v * s;
  groundShadow(g, x, baseY + u(4), u(104), u(20), 0.18);
  g.lineStyle(u(14), 0x6b5a49, 1);
  g.lineBetween(x - u(14), baseY - u(66), x - u(16), baseY - u(6));
  g.lineBetween(x + u(14), baseY - u(66), x + u(16), baseY - u(6));
  g.fillStyle(robe, 1);
  g.beginPath();
  g.moveTo(x - u(36), baseY - u(56));
  g.lineTo(x + u(36), baseY - u(56));
  g.lineTo(x + u(26), baseY - u(158));
  g.lineTo(x - u(26), baseY - u(158));
  g.closePath();
  g.fillPath();
  g.lineStyle(u(5), THEME.outline, 1);
  g.strokePath();
  g.lineStyle(u(14), robe, 1);
  if (laughing) {
    g.beginPath();
    g.moveTo(x - u(24), baseY - u(142));
    g.lineTo(x - u(30), baseY - u(196));
    g.strokePath();
    circle(g, x - u(32), baseY - u(200), u(13), SKIN, THEME.outline, u(4));
  } else {
    g.beginPath();
    g.moveTo(x - u(24), baseY - u(140));
    g.lineTo(x - u(34), baseY - u(76));
    g.strokePath();
    g.beginPath();
    g.moveTo(x + u(24), baseY - u(140));
    g.lineTo(x + u(34), baseY - u(76));
    g.strokePath();
  }
  const hy = baseY - u(196);
  circle(g, x, hy, u(32), SKIN, THEME.outline, u(5));
  g.fillStyle(0x3a2f26, 1);
  g.beginPath();
  g.arc(x, hy, u(32), Math.PI * 1.02, Math.PI * 1.98, false);
  g.closePath();
  g.fillPath();
  circle(g, x, hy - u(34), u(11), 0x3a2f26, THEME.outline, u(4));
  if (back) return;
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - u(12), hy - u(2), u(4));
  g.fillCircle(x + u(12), hy - u(2), u(4));
  if (laughing) {
    g.lineStyle(u(4), THEME.outline, 1);
    g.beginPath();
    g.arc(x, hy + u(14), u(11), 0, Math.PI, false);
    g.strokePath();
    g.lineStyle(u(4), THEME.inkSoft, 1);
    for (let i = 0; i < 3; i += 1) {
      g.lineBetween(
        x + u(46 + i * 14), hy - u(24 - i * 12),
        x + u(58 + i * 14), hy - u(30 - i * 12),
      );
    }
  } else {
    g.lineStyle(u(4), THEME.outline, 1);
    g.beginPath();
    g.arc(x, hy + u(12), u(10), Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
  }
}