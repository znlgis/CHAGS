import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN, WAIT } from '@chags/templates/core';
import type { WaitLevel, WaitStageMetrics } from '@chags/templates';
import { clamp01 } from '@chags/game-kit';

/**
 * 隔岸观火：一条河，两岸。
 *
 * 对岸是两兄弟的两拨火堆 —— **越烧越小**，人一个一个走散；自己这一岸只有一个人坐着。
 * 全程没有交战、没有兵器：孩子看到的是"火小了、人散了"，不是"打起来了"。
 * 两处"过河劝架"画在河边（渡船与浅滩）：点一次，火又旺一点 —— 因为他们转头冲你来了。
 *
 * 静态的东西（天、两岸、河、坐着的人）在 drawWorld 里画一次；
 * 火堆的大小、水面、对岸的人、河边的两处渡口每帧重画（drawStage）。
 */

const W = DESIGN.width;
const H = DESIGN.height;
const SKY_TOP = 150;

/** 对岸：两兄弟的营地 */
export const FAR = { top: 300, bottom: 560, fireY: 498 } as const;
/** 河 */
export const RIVER = { top: 560, bottom: 880 } as const;
/** 自己这一岸 */
export const NEAR_TOP = 880;
/** 对岸两拨人（也是两处渡口的正上方） */
export const CAMP_X = [170, 580] as const;

const SKY = [0x2f3a5e, 0x3d4a72, 0x54507a] as const;
const SKY_GLOW = 0xa06a56;
const FAR_GROUND = 0x6d6353;
const FAR_GROUND_DEEP = 0x575044;
const WATER = [0x36506e, 0x2c425c, 0x24374e] as const;
const NEAR_GROUND = 0x7f7a6a;
const NEAR_GROUND_DEEP = 0x635f52;
const FIRE = 0xf2843c;
const ROBE = 0x4a5a7c;
const ROBE_DEEP = 0x39476a;
const SKIN = 0xf6d3ae;

export interface WorldState {
  phase: 'wait' | 'arrived';
  /** 点"过河劝架"时曹操摇一下头 */
  shake: number;
}


// ---------------- 天与两岸 ----------------

function sky(g: Phaser.GameObjects.Graphics, t: number): void {
  const cuts = [SKY_TOP, 380, 520, FAR.top];
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(SKY[i]!, 1);
    g.fillRect(0, cuts[i]!, W, cuts[i + 1]! - cuts[i]!);
  }
  // 天边最后一点晚霞
  g.fillStyle(SKY_GLOW, 0.28);
  g.fillEllipse(W / 2, FAR.top - 20, 720, 150);
  g.fillStyle(0xd08a6a, 0.16);
  g.fillEllipse(W / 2, FAR.top - 6, 520, 90);
  for (const [sx, sy, sr] of [[92, 214, 4], [268, 260, 3], [430, 196, 4], [612, 244, 3], [700, 320, 3]] as const) {
    g.fillStyle(THEME.paper, 0.4 + 0.3 * Math.sin(t / 800 + sx));
    g.fillCircle(sx, sy, sr);
  }
}

function tents(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, robe: number): void {
  groundShadow(g, x, y + 30 * s, 150 * s, 30 * s, 0.18);
  g.fillStyle(shade(robe, 1.25), 1);
  g.beginPath();
  g.moveTo(x - 66 * s, y + 28 * s);
  g.lineTo(x, y - 70 * s);
  g.lineTo(x + 66 * s, y + 28 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(0x2c2a33, 0.85);
  g.beginPath();
  g.moveTo(x - 18 * s, y + 28 * s);
  g.lineTo(x, y - 12 * s);
  g.lineTo(x + 18 * s, y + 28 * s);
  g.closePath();
  g.fillPath();
}

function farBank(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FAR_GROUND_DEEP, 1);
  g.fillRect(0, FAR.top, W, FAR.bottom - FAR.top + 8);
  g.fillStyle(FAR_GROUND, 1);
  g.fillRect(0, FAR.top, W, FAR.bottom - FAR.top - 30);
  g.lineStyle(5, THEME.outline, 0.28);
  g.lineBetween(0, FAR.bottom, W, FAR.bottom);
  // 岸线上的一排苇草
  for (let i = 0; i < 15; i += 1) {
    const x = 26 + i * 51;
    g.lineStyle(5, 0x8a7a52, 0.8);
    g.lineBetween(x, FAR.bottom - 4, x - 8, FAR.bottom - 44);
    g.lineBetween(x, FAR.bottom - 4, x + 10, FAR.bottom - 38);
  }
  // 两拨营地：帐篷与旗
  CAMP_X.forEach((x, i) => {
    const robe = i === 0 ? 0x6a5a86 : 0x86604a;
    tents(g, x - 62, FAR.top + 168, 0.62, robe);
    tents(g, x + 74, FAR.top + 186, 0.5, robe);
    g.lineStyle(7, THEME.woodDeep, 1);
    g.lineBetween(x + 6, FAR.top + 214, x + 6, FAR.top + 84);
    g.fillStyle(shade(robe, 1.15), 1);
    g.fillTriangle(x + 8, FAR.top + 88, x + 8, FAR.top + 132, x + 66, FAR.top + 108);
  });
  // 中间那块空地：等对岸散尽，光就落在这儿
  g.fillStyle(shade(FAR_GROUND, 0.92), 1);
  g.fillEllipse(W / 2, FAR.bottom - 44, 240, 74);
}

function river(g: Phaser.GameObjects.Graphics, t: number): void {
  const cuts = [RIVER.top, 700, 800, RIVER.bottom];
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(WATER[i]!, 1);
    g.fillRect(0, cuts[i]!, W, cuts[i + 1]! - cuts[i]!);
  }
  g.fillStyle(0xffffff, 0.28);
  g.fillRect(0, RIVER.top, W, 5);
  for (let row = 0; row < 4; row += 1) {
    const y = RIVER.top + 40 + row * 78;
    const drift = Math.sin(t / 1100 + row) * 40;
    g.lineStyle(5, shade(WATER[row % 3]!, 1.5), 0.4);
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 220 + drift + row * 70) % (W + 240)) - 120;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 70, y - 9);
      g.lineTo(x + 140, y + 2);
      g.lineTo(x + 196, y - 6);
      g.strokePath();
    }
  }
}

function nearBank(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(NEAR_GROUND_DEEP, 1);
  g.fillRect(0, NEAR_TOP, W, H - NEAR_TOP);
  g.fillStyle(NEAR_GROUND, 1);
  g.fillRect(0, NEAR_TOP, W, 120);
  g.lineStyle(6, THEME.outline, 0.3);
  g.lineBetween(0, NEAR_TOP, W, NEAR_TOP);
  // 自己这一岸：一块坐平的石头、一盏没点的灯、几块小石头
  g.fillStyle(THEME.stoneDeep, 1);
  g.fillEllipse(214, 1128, 240, 90);
  g.fillStyle(THEME.stone, 1);
  g.fillEllipse(210, 1110, 228, 74);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(210, 1110, 228, 74);
  circle(g, 640, 1210, 30, THEME.stone, THEME.outline, 5);
  circle(g, 560, 1268, 22, THEME.stone, THEME.outline, 5);
}

/** 坐着的人：背影，脸朝河（所以没有五官）—— 打坐一样盘着腿 */
function caoSeated(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, shake: number): void {
  const cx = x + shake;
  groundShadow(g, x, y + 12 * s, 210 * s, 36 * s, 0.18);
  roundRect(g, cx - 92 * s, y - 34 * s, 184 * s, 50 * s, 24 * s, ROBE_DEEP, THEME.outline, 6 * s);
  g.fillStyle(ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 66 * s, y - 30 * s);
  g.lineTo(cx + 66 * s, y - 30 * s);
  g.lineTo(cx + 50 * s, y - 158 * s);
  g.lineTo(cx - 50 * s, y - 158 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokePath();
  // 一只手搭在膝上，一只手撑在身后
  g.lineStyle(20 * s, ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 44 * s, y - 120 * s);
  g.lineTo(cx - 78 * s, y - 46 * s);
  g.strokePath();
  circle(g, cx - 82 * s, y - 40 * s, 15 * s, SKIN, THEME.outline, 5 * s);
  // 后脑与头巾（背对着我们）
  circle(g, cx, y - 192 * s, 44 * s, 0x4a3a2e, THEME.outline, 6 * s);
  g.fillStyle(ROBE_DEEP, 1);
  g.beginPath();
  g.arc(cx, y - 192 * s, 46 * s, Math.PI * 1.04, Math.PI * 1.96, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(6 * s, THEME.outline, 1);
  g.beginPath();
  g.arc(cx, y - 186 * s, 44 * s, Math.PI * 1.04, Math.PI * 1.96, false);
  g.strokePath();
}

/** 站起来了：对岸散尽了，该起身了 */
function caoStanding(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, shake: number): void {
  const cx = x + shake;
  groundShadow(g, x, y + 8 * s, 190 * s, 34 * s, 0.2);
  roundRect(g, cx - 60 * s, y - 34 * s, 54 * s, 34 * s, 16 * s, 0x5b4a38, THEME.outline, 6 * s);
  roundRect(g, cx + 8 * s, y - 34 * s, 54 * s, 34 * s, 16 * s, 0x5b4a38, THEME.outline, 6 * s);
  g.fillStyle(ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 56 * s, y - 42 * s);
  g.lineTo(cx + 56 * s, y - 42 * s);
  g.lineTo(cx + 42 * s, y - 196 * s);
  g.lineTo(cx - 42 * s, y - 196 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(ROBE_DEEP, 1);
  g.fillRect(cx - 48 * s, y - 122 * s, 96 * s, 16 * s);
  g.lineStyle(20 * s, ROBE, 1);
  g.beginPath();
  g.moveTo(cx - 34 * s, y - 176 * s);
  g.lineTo(cx - 80 * s, y - 108 * s);
  g.strokePath();
  circle(g, cx - 84 * s, y - 102 * s, 16 * s, SKIN, THEME.outline, 5 * s);
  g.lineStyle(20 * s, ROBE, 1);
  g.beginPath();
  g.moveTo(cx + 34 * s, y - 176 * s);
  g.lineTo(cx + 78 * s, y - 138 * s);
  g.strokePath();
  circle(g, cx + 82 * s, y - 134 * s, 16 * s, SKIN, THEME.outline, 5 * s);
  circle(g, cx, y - 232 * s, 42 * s, 0x4a3a2e, THEME.outline, 6 * s);
  g.fillStyle(ROBE_DEEP, 1);
  g.beginPath();
  g.arc(cx, y - 232 * s, 44 * s, Math.PI * 1.04, Math.PI * 1.96, false);
  g.closePath();
  g.fillPath();
}

// ---------------- 对岸的两拨人 ----------------

/** 一拨人：火堆 + 几个背影小人。人随着火一起少下去 —— 他们自己散的 */
function campFolk(
  g: Phaser.GameObjects.Graphics,
  x: number,
  t: number,
  fade: number,
  dir: number,
  robe: number,
): void {
  const alive = Math.max(0, Math.round(3 * fade));
  for (let i = 0; i < alive; i += 1) {
    const walk = (1 - fade) * 54 * dir;
    const px = x + (i - 1) * 74 + walk + Math.sin(t / 600 + i * 2) * 3;
    const py = FAR.fireY + 28 + (i % 2) * 12;
    groundShadow(g, px, py + 4, 76, 18, 0.16 * fade);
    g.lineStyle(11, 0x4a4450, fade);
    g.lineBetween(px - 10, py - 52, px - 10, py);
    g.lineBetween(px + 10, py - 52, px + 10, py);
    g.fillStyle(robe, fade);
    g.beginPath();
    g.moveTo(px - 28, py - 46);
    g.lineTo(px + 28, py - 46);
    g.lineTo(px + 19, py - 128);
    g.lineTo(px - 19, py - 128);
    g.closePath();
    g.fillPath();
    circle(g, px, py - 156, 25, 0x4a3a2e, THEME.outline, 4, fade);
  }
}

/** 火堆：越烧越小 —— 这一计最要紧的一眼就看明白的东西 */
function campFire(g: Phaser.GameObjects.Graphics, x: number, t: number, scale: number): void {
  const s = Math.max(0, scale);
  g.fillStyle(THEME.outline, 0.24 * Math.max(0.3, s));
  g.fillEllipse(x, FAR.fireY + 12, 150 * s + 40, 34 * Math.max(0.4, s));
  g.lineStyle(10, THEME.woodDeep, 1);
  g.lineBetween(x - 46, FAR.fireY, x + 46, FAR.fireY + 12);
  g.lineBetween(x - 46, FAR.fireY + 12, x + 46, FAR.fireY);
  if (s <= 0.02) {
    g.fillStyle(0x5c5c60, 0.55);
    g.fillEllipse(x, FAR.fireY + 6, 76, 20);
    g.fillStyle(0x8a8a90, 0.28);
    g.fillEllipse(x + 18, FAR.fireY - 6, 34, 12);
    return;
  }
  const flick = 0.85 + 0.15 * Math.sin(t / 110 + x);
  const h = 104 * s * flick;
  g.fillStyle(FIRE, 0.14 * s);
  g.fillCircle(x, FAR.fireY - 10 * s, 170 * s);
  g.fillStyle(FIRE, 0.92);
  g.fillTriangle(x - 32 * s, FAR.fireY, x + 32 * s, FAR.fireY, x + Math.sin(t / 90 + x) * 10 * s, FAR.fireY - h);
  g.fillStyle(0xffd08a, 0.95);
  g.fillTriangle(x - 16 * s, FAR.fireY, x + 16 * s, FAR.fireY, x + Math.sin(t / 80 + x) * 7 * s, FAR.fireY - h * 0.56);
}

/** 水面上那两团火光：火小了，倒影也淡下去 */
function reflections(g: Phaser.GameObjects.Graphics, t: number, fade: number): void {
  CAMP_X.forEach((x, i) => {
    if (fade <= 0.02) return;
    const flick = 0.7 + 0.3 * Math.sin(t / 160 + i);
    g.fillStyle(FIRE, 0.16 * fade * flick);
    g.fillEllipse(x, RIVER.top + 90, 150, 320);
    g.fillStyle(0xffd08a, 0.12 * fade * flick);
    g.fillEllipse(x, RIVER.top + 60, 80, 180);
  });
}

/** 河边的两处渡口：点它就得等更久 —— 因为一过去，他们就一起冲你来 */
function crossings(
  g: Phaser.GameObjects.Graphics,
  level: WaitLevel,
  hits: number,
  t: number,
): void {
  const r = WAIT.temptationRadius - 14;
  level.temptations.forEach((temptation, i) => {
    const spent = hits >= level.penaltyCap;
    const pulse = 0.5 + 0.5 * Math.sin(t / 620 + i * 1.9);
    if (!spent) {
      g.fillStyle(THEME.gold, 0.1 + 0.12 * pulse);
      g.fillCircle(temptation.x, temptation.y, r + 22 + 8 * pulse);
    }
    g.fillStyle(shade(THEME.card, 0.76), 1);
    g.fillCircle(temptation.x, temptation.y + 10, r);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(temptation.x, temptation.y + 10, r);
    g.fillStyle(spent ? 0xdcd6c8 : THEME.card, 1);
    g.fillCircle(temptation.x, temptation.y, r);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(temptation.x, temptation.y, r);
    if (temptation.kind === 'ford') steppingStones(g, temptation.x, temptation.y, spent ? 0.5 : 1);
    else boat(g, temptation.x, temptation.y, spent ? 0.5 : 1);
  });
}

/** 渡船：一条拴在岸边的小船 */
function boat(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number): void {
  g.fillStyle(THEME.wood, alpha);
  g.beginPath();
  g.moveTo(x - 42, y - 14);
  g.lineTo(x + 42, y - 14);
  g.lineTo(x + 28, y + 22);
  g.lineTo(x - 28, y + 22);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, THEME.outline, alpha);
  g.strokePath();
  g.lineStyle(5, THEME.woodDeep, alpha);
  g.lineBetween(x - 30, y - 6, x + 30, y - 6);
  g.lineBetween(x + 34, y - 6, x + 62, y - 40);
  g.lineStyle(4, 0x8a7a52, alpha);
  g.beginPath();
  g.arc(x, y + 4, 26, Math.PI * 0.15, Math.PI * 0.85, false);
  g.strokePath();
}

/** 浅滩上的踏石：一步一块 */
function steppingStones(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number): void {
  for (let i = 0; i < 3; i += 1) {
    const sx = x - 30 + i * 30;
    const sy = y + 16 - i * 16;
    circle(g, sx, sy, 17 - i * 2, THEME.stone, THEME.outline, 4, alpha);
  }
}

// ---------------- 世界（画一次） ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, state: WorldState): void {
  sky(g, 0);
  farBank(g);
  river(g, 0);
  nearBank(g);
  if (state.phase === 'arrived') {
    caoStanding(g, 214, 1096, 0.92, state.shake);
    return;
  }
  caoSeated(g, 214, 1104, 0.92, state.shake);
}

// ---------------- 每帧重画的那一层 ----------------

export function drawStage(g: Phaser.GameObjects.Graphics, level: WaitLevel, metrics: WaitStageMetrics): void {
  const t = metrics.elapsedMs;
  const p = clamp01(metrics.progress);
  const fade = metrics.arrived ? 0 : 1 - p;

  river(g, t);
  reflections(g, t, fade);
  CAMP_X.forEach((x, i) => {
    campFolk(g, x, t, fade, i === 0 ? -1 : 1, i === 0 ? 0x6a5a86 : 0x86604a);
    campFire(g, x, t, fade);
  });

  if (metrics.arrived) {
    // 对岸散尽了：只剩一地安静
    g.fillStyle(THEME.gold, 0.12);
    g.fillEllipse(W / 2, FAR.bottom - 30, 420, 150);
    for (const [wx, wy] of [[CAMP_X[0], FAR.fireY - 40], [CAMP_X[1], FAR.fireY - 40]] as const) {
      g.fillStyle(0xffffff, 0.12);
      g.fillEllipse(wx + Math.sin(t / 900 + wx) * 14, wy - 40, 60, 150);
    }
    return;
  }
  crossings(g, level, metrics.hits, t);
}

/** 收尾：火堆只剩灰，对岸那点光落在空地上 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillRect(0, SKY_TOP, W, FAR.bottom - SKY_TOP);
  g.fillStyle(0xffe6b8, 0.1);
  g.fillRect(0, RIVER.top, W, H - RIVER.top);
  g.fillStyle(0xfff3d0, 0.18);
  g.beginPath();
  g.moveTo(300, SKY_TOP);
  g.lineTo(452, SKY_TOP);
  g.lineTo(400, FAR.bottom + 20);
  g.closePath();
  g.fillPath();
}

// ---------------- 分幕插图 ----------------

function beatScene(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fireScale: number,
  people: number,
): void {
  g.fillStyle(SKY[1]!, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(SKY_GLOW, 0.3);
  g.fillEllipse(x + w / 2, y + h * 0.34, w * 0.9, 90);
  // 对岸
  g.fillStyle(FAR_GROUND, 1);
  g.fillRect(x + 6, y + h * 0.3, w - 12, h * 0.18);
  // 河
  g.fillStyle(WATER[1]!, 1);
  g.fillRect(x + 6, y + h * 0.48, w - 12, h * 0.3);
  g.fillStyle(0xffffff, 0.24);
  g.fillRect(x + 6, y + h * 0.48, w - 12, 5);
  // 自己这一岸
  g.fillStyle(NEAR_GROUND, 1);
  g.fillRoundedRect(x + 6, y + h * 0.78, w - 12, h * 0.22 - 6, { tl: 40, tr: 40, bl: 28, br: 28 });

  const fireY = y + h * 0.42;
  const campX = [x + w * 0.26, x + w * 0.74];
  campX.forEach((fx, i) => {
    tents(g, fx - w * 0.12, y + h * 0.38, 0.34, i === 0 ? 0x6a5a86 : 0x86604a);
    tents(g, fx + w * 0.11, y + h * 0.4, 0.28, i === 0 ? 0x6a5a86 : 0x86604a);
    const s = Math.max(0, fireScale);
    g.lineStyle(6, THEME.woodDeep, 1);
    g.lineBetween(fx - 24, fireY + 6, fx + 24, fireY + 12);
    g.lineBetween(fx - 24, fireY + 12, fx + 24, fireY + 6);
    if (s > 0.05) {
      g.fillStyle(FIRE, 0.9);
      g.fillTriangle(fx - 17 * s, fireY, fx + 17 * s, fireY, fx, fireY - 62 * s);
      g.fillStyle(0xffd08a, 0.95);
      g.fillTriangle(fx - 8 * s, fireY, fx + 8 * s, fireY, fx, fireY - 34 * s);
    } else {
      g.fillStyle(0x8a8a90, 0.4);
      g.fillEllipse(fx, fireY + 6, 44, 14);
    }
  });
  // 对岸的小人：第二幕只剩两个走开的背影
  for (let i = 0; i < people; i += 1) {
    const side = i % 2;
    const px = campX[side]! + (i - 1) * 30 + (people < 3 ? (side === 0 ? -46 : 46) : 0);
    const py = y + h * 0.46;
    g.lineStyle(9, 0x4a4450, 1);
    g.lineBetween(px - 8, py - 44, px - 8, py);
    g.lineBetween(px + 8, py - 44, px + 8, py);
    g.fillStyle(side === 0 ? 0x6a5a86 : 0x86604a, 1);
    g.fillRect(px - 20, py - 108, 40, 66);
    circle(g, px, py - 130, 20, 0x4a3a2e, THEME.outline, 4);
  }
  // 坐着的人（自己这一岸，背影）
  g.fillStyle(ROBE_DEEP, 1);
  g.fillEllipse(x + w * 0.24, y + h * 0.92, 130, 46);
  g.fillStyle(ROBE, 1);
  g.beginPath();
  g.moveTo(x + w * 0.24 - 44, y + h * 0.9);
  g.lineTo(x + w * 0.24 + 44, y + h * 0.9);
  g.lineTo(x + w * 0.24 + 32, y + h * 0.74);
  g.lineTo(x + w * 0.24 - 32, y + h * 0.74);
  g.closePath();
  g.fillPath();
  circle(g, x + w * 0.24, y + h * 0.7, 30, 0x4a3a2e, THEME.outline, 5);
}

/** 两幕：①对岸两兄弟吵起来了 ②曹操坐着没动，对岸自己散开 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  if (index === 0) beatScene(g, x, y, w, h, 1, 4);
  else beatScene(g, x, y, w, h, 0.22, 2);
}