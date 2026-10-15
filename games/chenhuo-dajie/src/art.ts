import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { WindowStageState } from '@chags/templates';
import type { WindowJob } from '@chags/templates/schemas';

/**
 * 夜里的水寨：**没有打斗、没有加害** ——
 * 稳的时候岸上有巡逻的灯，靠近就被赶回来；乱的时候火光四起、巡逻的灯跑向远处，
 * 这时候才可以干活儿（渡船 / 粮囤 / 水门），火光一灭，没干完的活儿就得下个窗口再来。
 */

const TOP = 150;
/** 夜空 */
const NIGHT = 0x22304f;
const NIGHT_DEEP = 0x16203a;
const WATER = 0x2f5875;
const WATER_DEEP = 0x24455e;
const PIER = 0x4a3a2c;
const FIRE = 0xf2843c;

/** 寨墙、望楼、栈桥与水面的位置 */
export const FORT = {
  towerX: 168,
  towerTop: 520,
  wallTop: 700,
  wallBottom: 900,
  pierY: 968,
  waterTop: 1006,
  lanternY: 664,
} as const;
export const MOON = { x: 604, y: 296, r: 56 } as const;

/** 巡逻的灯走到哪儿：稳的时候一路扫过来，窗口一开就掉头跑远 */
export function lanternX(state: WindowStageState): number {
  const p = Math.min(1, Math.max(0, state.progress));
  if (state.phase === 'window') return 430 + 300 * Math.min(1, p * 2.4);
  if (state.phase === 'warn') return 430;
  return 690 - 260 * p;
}

/** 一个值守的小人（剪影，没有兵器） */
function drawWatch(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 1): void {
  groundShadow(g, x, y + 4, 44 * w, 12, 0.2);
  roundRect(g, x - 17 * w, y - 46 * w, 34 * w, 48 * w, 15 * w, NIGHT_DEEP, THEME.outline, 4);
  circle(g, x, y - 58 * w, 15 * w, NIGHT_DEEP, THEME.outline, 4);
}

/** 巡逻的灯：一盏提在手里的小灯笼 */
function drawLantern(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  t: number,
  alpha = 1,
): void {
  drawWatch(g, x, y + 26);
  const flicker = 0.85 + Math.sin(t / 140) * 0.15;
  g.fillStyle(THEME.gold, 0.2 * alpha);
  g.fillCircle(x + 26, y, 66 * flicker);
  g.fillStyle(FIRE, 0.28 * alpha);
  g.fillCircle(x + 26, y, 40 * flicker);
  roundRect(g, x + 12, y - 16, 28, 34, 10, THEME.gold, THEME.outline, 4, alpha);
  g.lineStyle(4, THEME.outline, alpha);
  g.lineBetween(x + 26, y - 16, x + 26, y - 34);
}

/** 火苗：窗口一开，寨墙上这里那里都烧起来（跳动的三角形） */
function drawFlame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  t: number,
): void {
  const wobble = Math.sin(t / 90 + x) * 0.16;
  const h = 54 * scale * (1 + wobble);
  g.fillStyle(FIRE, 0.9);
  g.fillTriangle(x - 16 * scale, y, x + 16 * scale, y, x + wobble * 14, y - h);
  g.fillStyle(0xffc45c, 0.95);
  g.fillTriangle(x - 8 * scale, y, x + 8 * scale, y, x + wobble * 10, y - h * 0.6);
}

/** 寨墙与望楼（剪影） */
function drawFort(g: Phaser.GameObjects.Graphics, lit: number, t: number): void {
  const W = DESIGN.width;
  g.fillStyle(NIGHT_DEEP, 1);
  // 望楼
  g.fillRect(FORT.towerX - 46, FORT.towerTop, 92, FORT.wallTop - FORT.towerTop + 10);
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillTriangle(FORT.towerX - 74, FORT.towerTop, FORT.towerX, FORT.towerTop - 70, FORT.towerX + 74, FORT.towerTop);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(FORT.towerX - 74, FORT.towerTop, FORT.towerX, FORT.towerTop - 70, FORT.towerX + 74, FORT.towerTop);
  g.strokeRect(FORT.towerX - 46, FORT.towerTop, 92, FORT.wallTop - FORT.towerTop + 10);
  // 寨墙 + 城垛
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(0, FORT.wallTop, W, FORT.wallBottom - FORT.wallTop);
  for (let x = 0; x < W; x += 78) {
    g.fillRect(x + 8, FORT.wallTop - 26, 46, 30);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRect(x + 8, FORT.wallTop - 26, 46, 30);
  }
  g.lineStyle(7, THEME.outline, 1);
  g.strokeRect(0, FORT.wallTop, W, FORT.wallBottom - FORT.wallTop);
  // 木纹
  g.lineStyle(4, shade(NIGHT_DEEP, 1.45), 0.8);
  for (let x = 26; x < W; x += 74) {
    g.lineBetween(x, FORT.wallTop + 6, x, FORT.wallBottom - 6);
  }
  if (lit <= 0) return;
  // 火光四起
  for (const [fx, fs] of [[70, 1], [210, 0.8], [352, 1.1], [498, 0.9], [640, 1.05]] as const) {
    drawFlame(g, fx, FORT.wallTop - 22, fs * lit, t + fx * 3);
  }
  g.fillStyle(FIRE, 0.12 * lit);
  g.fillRect(0, FORT.wallTop - 150, W, 340);
}

/** 栈桥：夜里干活儿的地方 */
function drawPier(g: Phaser.GameObjects.Graphics): void {
  const W = DESIGN.width;
  g.fillStyle(PIER, 1);
  g.fillRect(0, FORT.pierY, W, FORT.waterTop - FORT.pierY);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRect(0, FORT.pierY, W, FORT.waterTop - FORT.pierY);
  g.lineStyle(4, shade(PIER, 1.25), 0.9);
  for (let x = 30; x < W; x += 62) g.lineBetween(x, FORT.pierY + 4, x, FORT.waterTop - 4);
}

/** 水：一层一层的波纹，月亮照下来 */
function drawWater(g: Phaser.GameObjects.Graphics, t: number): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  g.fillStyle(WATER, 1);
  g.fillRect(0, FORT.waterTop, W, H - FORT.waterTop);
  g.fillStyle(WATER_DEEP, 1);
  g.fillRect(0, FORT.waterTop + 190, W, H - FORT.waterTop - 190);
  g.fillStyle(THEME.paper, 0.12);
  g.fillEllipse(MOON.x, FORT.waterTop + 250, 210, 420);
  for (let row = 0; row < 5; row += 1) {
    const y = FORT.waterTop + 26 + row * 62;
    const drift = Math.sin(t / 900 + row) * 34;
    g.lineStyle(5, shade(WATER, 1.35), 0.55);
    for (let i = 0; i < 4; i += 1) {
      const w = 150 - i * 10;
      const x = ((i * 210 + drift + row * 60) % (W + 200)) - 90;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w * 0.4, y - 10);
      g.lineTo(x + w * 0.8, y + 2);
      g.lineTo(x + w, y - 6);
      g.strokePath();
    }
  }
}

/** 渡船：桅杆 + 船帮 */
function drawBoat(g: Phaser.GameObjects.Graphics, x: number, y: number, done: boolean): void {
  g.fillStyle(THEME.paper, 0.14);
  g.fillEllipse(x, y + 34, 190, 44);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x, y - 96, x, y - 6);
  g.fillStyle(done ? THEME.gold : THEME.paperDeep, 1);
  g.fillTriangle(x + 6, y - 92, x + 6, y - 20, x + 74, y - 30);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x + 6, y - 92, x + 6, y - 20, x + 74, y - 30);
  g.fillStyle(THEME.wood, 1);
  g.fillEllipse(x, y, 168, 66);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y, 168, 66);
  g.fillStyle(done ? THEME.gold : shade(THEME.wood, 1.18), 1);
  g.fillEllipse(x, y - 8, 132, 34);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x, y - 8, 132, 34);
}

/** 粮囤：圆仓 + 草帽顶 */
function drawGranary(g: Phaser.GameObjects.Graphics, x: number, y: number, done: boolean): void {
  groundShadow(g, x, y + 74, 170, 34, 0.22);
  g.fillStyle(shade(THEME.wood, 0.9), 1);
  g.fillRoundedRect(x - 70, y - 40, 140, 116, 26);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - 70, y - 40, 140, 116, 26);
  g.fillStyle(done ? THEME.gold : THEME.sandDeep, 1);
  g.fillTriangle(x - 88, y - 34, x + 88, y - 34, x, y - 108);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 88, y - 34, x + 88, y - 34, x, y - 108);
  if (!done) return;
  g.fillStyle(THEME.paper, 0.9);
  g.fillEllipse(x, y - 40, 44, 26);
}

/** 水门：水面上的一道闸门 */
function drawGate(g: Phaser.GameObjects.Graphics, x: number, y: number, done: boolean): void {
  g.fillStyle(THEME.paper, 0.12);
  g.fillEllipse(x, y + 46, 200, 40);
  g.fillStyle(shade(THEME.wood, 0.8), 1);
  g.fillRoundedRect(x - 84, y - 96, 30, 176, 12);
  g.fillRoundedRect(x + 54, y - 96, 30, 176, 12);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - 84, y - 96, 30, 176, 12);
  g.strokeRoundedRect(x + 54, y - 96, 30, 176, 12);
  g.fillStyle(done ? THEME.gold : shade(THEME.wood, 1.1), 1);
  g.fillRoundedRect(x - 96, y - 122, 192, 34, 14);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - 96, y - 122, 192, 34, 14);
  if (done) {
    // 干完了：门洞开着
    g.fillStyle(shade(THEME.gold, 1.05), 0.85);
    g.fillRoundedRect(x - 54, y - 76, 108, 132, 18);
  } else {
    g.fillStyle(NIGHT_DEEP, 0.75);
    g.fillRoundedRect(x - 54, y - 76, 108, 132, 18);
  }
}

/** 活儿外面的进度圈：干了多少一眼看得见；干完了套一圈金 */
function drawRing(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  progress: number,
  done: boolean,
): void {
  const r = radius + 22;
  g.lineStyle(12, THEME.outline, 0.28);
  g.strokeCircle(x, y, r);
  if (done) {
    g.lineStyle(12, THEME.gold, 0.95);
    g.strokeCircle(x, y, r);
    return;
  }
  if (progress <= 0) return;
  g.lineStyle(12, THEME.gold, 0.95);
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
  g.strokePath();
}

function kindOf(job: WindowJob, index: number): 'boat' | 'granary' | 'gate' {
  if (job.id === 'boat') return 'boat';
  if (job.id === 'grain') return 'granary';
  if (job.id === 'gate') return 'gate';
  return (['boat', 'granary', 'gate'] as const)[index % 3]!;
}

/** 整屏水寨 */
export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  state: WindowStageState,
  jobs: WindowJob[],
): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  const t = state.elapsedMs;

  // 夜空与月亮
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, TOP, W, FORT.waterTop - TOP + 10);
  g.fillStyle(NIGHT_DEEP, 0.6);
  g.fillRect(0, TOP, W, 240);
  circle(g, MOON.x, MOON.y, MOON.r + 26, THEME.paper, null, 0, 0.12);
  circle(g, MOON.x, MOON.y, MOON.r, 0xfff3d4, null, 0, 0.95);
  g.fillStyle(THEME.paper, 0.7);
  for (const [sx, sy, sr] of [[120, 250, 4], [300, 200, 3], [420, 330, 3], [700, 210, 4], [90, 420, 3], [660, 430, 3]] as const) {
    g.fillCircle(sx, sy, sr);
  }

  // 火光：稳的时候只有余烬，窗口一开就烧起来（canWork 才是"乱"）
  const lit = state.phase === 'window' ? 1 : state.phase === 'warn' ? 0.35 : 0.08;
  drawFort(g, lit, t);
  drawPier(g);
  drawWater(g, t);

  // 三件活儿
  jobs.forEach((job, i) => {
    const done = state.done.includes(job.id);
    const kind = kindOf(job, i);
    if (kind === 'boat') drawBoat(g, job.x, job.y, done);
    else if (kind === 'granary') drawGranary(g, job.x, job.y, done);
    else drawGate(g, job.x, job.y, done);
    drawRing(g, job.x, job.y, job.radius, state.work[job.id] ?? 0, done);
  });

  // 巡逻的灯：稳的时候一路扫过来，窗口一开就掉头跑远
  const lx = lanternX(state);
  const runAway = state.phase === 'window';
  drawLantern(g, lx, FORT.lanternY, t, runAway ? Math.max(0.25, 1 - state.progress * 1.1) : 1);

  if (state.finished) {
    g.fillStyle(THEME.gold, 0.1);
    g.fillRect(0, TOP, W, H - TOP);
  }
}

/** 收尾：活儿都干完了，水寨的灯一盏盏亮起来 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(430, 940, 360);
  g.lineStyle(8, THEME.gold, 0.5);
  g.strokeCircle(430, 940, 290);
}

/** 分幕插图：① 精兵北上会盟，城里只剩老弱 ② 越国的船趁夜出发 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(NIGHT, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  circle(g, x + w * 0.78, y + h * 0.2, 42, 0xfff3d4, null, 0, 0.95);
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(x, y + h * 0.62, w, h * 0.22);
  g.fillStyle(WATER, 1);
  g.fillRoundedRect(x - 20, y + h * 0.82, w + 40, h * 0.3, 30);

  if (index === 0) {
    // 精兵北上：一队人往远处走，营地只剩两个值守
    for (let i = 0; i < 4; i += 1) {
      drawWatch(g, x + w * (0.12 + i * 0.09), y + h * 0.72 - i * 8, 0.9);
    }
    drawWatch(g, x + w * 0.66, y + h * 0.74, 1);
    drawWatch(g, x + w * 0.82, y + h * 0.74, 0.9);
    // 城门与几面空旗
    g.fillStyle(shade(THEME.wood, 0.7), 1);
    g.fillRect(x + w * 0.44, y + h * 0.5, 24, h * 0.24);
    g.fillRect(x + w * 0.58, y + h * 0.5, 24, h * 0.24);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRect(x + w * 0.44, y + h * 0.5, 24, h * 0.24);
    g.strokeRect(x + w * 0.58, y + h * 0.5, 24, h * 0.24);
  } else {
    // 趁夜出发：两条船在水上，远处有火光
    drawBoat(g, x + w * 0.34, y + h * 0.78, false);
    drawBoat(g, x + w * 0.72, y + h * 0.88, true);
    drawFlame(g, x + w * 0.9, y + h * 0.66, 1.1, 300);
    drawFlame(g, x + w * 0.06, y + h * 0.7, 0.8, 500);
  }
}
