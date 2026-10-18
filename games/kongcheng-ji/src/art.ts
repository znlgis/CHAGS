import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { StillnessCalmStageState } from '@chags/templates';
import { clamp01 } from '@chags/game-kit';
import {
  AWAY, DRUM, FLAGS, GATE, HILL_TOP, MAX_MARKS, RIVER_BOTTOM, RIVER_TOP, ROAD_TOP, SKY_TOP, WALL_BOTTOM,
  WALL_TOP, WATCH, ZHAOYUN,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 暮色里的汉水与营寨：天将黑未黑，火把的光才看得清 */
const DUSK = 0x3a4766;
const DUSK_DEEP = 0x27314b;
const HILL = 0x2f3a52;
const RIVER = 0x4a6b8a;
const RIVER_LIGHT = 0x7fa3c0;
const WALL = 0x8a7458;
const WALL_DEEP = 0x6b5942;
const EARTH = 0x6f5c46;
const EARTH_LIGHT = 0x8a7459;
/** 门洞里的黑：越黑越像里头藏着人 —— 这一计的胆子全在这片黑里 */
const GATE_DARK = 0x241d18;
const SKIN = 0xf8dcbb;
const ROBE = 0xdde6f2;
const ROBE_DEEP = 0x9fb0c8;
const SCOUT = 0x4a5568;
const SCOUT_DEEP = 0x333d4d;
/** 火把的光：他盯着看的时候，这道光往墙上扫过来 */
const TORCH = 0xf2b134;

/** 平滑一步（走位用它，别一顿一顿的） */
const ease = (t: number): number => t * t * (3 - 2 * t);

// ---------------- 天、山、水 ----------------

/** 暮色：天将黑，几颗星已经出来了 */
function drawSky(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(DUSK, 1);
  g.fillRect(0, SKY_TOP, W, HILL_TOP - SKY_TOP);
  g.fillStyle(DUSK_DEEP, 0.45);
  g.fillRect(0, SKY_TOP, W, 74);
  for (let i = 0; i < 12; i += 1) {
    const sx = 28 + ((i * 149) % 700);
    const sy = SKY_TOP + 24 + ((i * 53) % 160);
    g.fillStyle(THEME.paper, 0.16 + 0.26 * (0.5 + 0.5 * Math.sin(t / 900 + i)));
    g.fillCircle(sx, sy, 3.4);
  }
  // 对岸的两层山脊
  g.fillStyle(shade(HILL, 0.86), 1);
  g.fillTriangle(-40, HILL_TOP, 250, HILL_TOP - 128, 560, HILL_TOP);
  g.fillTriangle(300, HILL_TOP, 560, HILL_TOP - 96, 820, HILL_TOP);
  g.fillStyle(HILL, 1);
  g.fillTriangle(-40, HILL_TOP, 180, HILL_TOP - 74, 420, HILL_TOP);
  g.fillTriangle(420, HILL_TOP, 640, HILL_TOP - 106, 820, HILL_TOP);
}

/** 汉水：营墙背后那一条水，风一吹就起几道细浪 */
function drawRiver(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(RIVER, 1);
  g.fillRect(0, RIVER_TOP, W, RIVER_BOTTOM - RIVER_TOP);
  g.fillStyle(RIVER_LIGHT, 0.45);
  g.fillRect(0, RIVER_TOP, W, 14);
  for (let i = 0; i < 5; i += 1) {
    const y = RIVER_TOP + 22 + i * 15;
    const phase = Math.sin(t / 720 + i) * 14;
    g.lineStyle(4, RIVER_LIGHT, 0.4);
    g.lineBetween(24 + i * 46 + phase, y, 190 + i * 52 + phase, y);
    g.lineBetween(W - 210 - i * 40 - phase, y + 6, W - 40 - i * 30 - phase, y + 6);
  }
}

/** 营门前面那条路：踩实的土路，散着几块石头 */
function drawRoad(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(EARTH, 1);
  g.fillRect(0, ROAD_TOP, W, H - ROAD_TOP);
  g.fillStyle(EARTH_LIGHT, 0.5);
  g.fillRect(0, ROAD_TOP, W, 40);
  g.fillStyle(THEME.outline, 0.12);
  g.fillRect(0, ROAD_TOP - 12, W, 16);
  for (let i = 0; i < 6; i += 1) {
    const sx = 60 + i * 124;
    const sy = ROAD_TOP + 96 + (i % 3) * 74;
    g.fillStyle(shade(THEME.stoneDeep, 1.12), 0.7);
    g.fillEllipse(sx, sy, 54, 22);
  }
}

// ---------------- 营墙与营门 ----------------

/** 营墙：夯土的墙身 + 一排垛口 */
function drawWall(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(WALL_DEEP, 1);
  g.fillRect(0, WALL_TOP, W, WALL_BOTTOM - WALL_TOP);
  g.fillStyle(WALL, 1);
  g.fillRect(0, WALL_TOP + 18, W, WALL_BOTTOM - WALL_TOP - 34);
  // 夯土的横纹（一层层夯出来的）
  g.lineStyle(4, shade(WALL, 0.88), 0.65);
  for (let i = 1; i < 4; i += 1) {
    const y = WALL_TOP + 18 + i * 86;
    g.lineBetween(0, y, W, y);
  }
  // 垛口：一排站得住的缺口
  for (let i = 0; i < 7; i += 1) {
    const x = 54 + i * 108;
    roundRect(g, x - 34, WALL_TOP - 36, 68, 46, 8, shade(WALL, 1.06), THEME.outline, 5);
  }
  // 墙根下的一道暗影
  g.fillStyle(THEME.outline, 0.16);
  g.fillRect(0, WALL_BOTTOM - 14, W, 18);
}

/**
 * 营门。**大开营门是这一关唯一的动作**：
 * - 门关着的时候：两扇厚木门合在门洞里，还上门闩；
 * - 门开了以后：门洞里黑得看不见底，两扇门贴在门框两侧 —— 谁看都觉得里头有人。
 */
function drawGate(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  const { x, y, radius } = GATE;
  const outer = radius + 20;
  // 门框：石头砌的一圈
  roundRect(g, x - outer, y - outer, outer * 2, outer * 2, 64, shade(THEME.stone, 0.88), THEME.outline, 7);
  roundRect(g, x - radius, y - radius, radius * 2, radius * 2, 54, shade(THEME.stoneDeep, 1.12), THEME.outline, 6);
  // 门洞
  if (stage.gateOpen) {
    g.fillStyle(GATE_DARK, 1);
    g.fillRoundedRect(x - radius + 12, y - radius + 12, (radius - 12) * 2, (radius - 12) * 2, 46);
    // 贴在门框两侧的两扇门（大开着的门叶，只看得见一条边）
    roundRect(g, x - radius + 4, y - radius + 26, 34, (radius - 26) * 2, 12, shade(THEME.woodDeep, 0.9), THEME.outline, 5);
    roundRect(g, x + radius - 38, y - radius + 26, 34, (radius - 26) * 2, 12, shade(THEME.woodDeep, 0.9), THEME.outline, 5);
    // 门里透出来的一点微光：不是火光，是"空得让人心里发毛"
    g.fillStyle(THEME.paper, 0.06);
    g.fillRoundedRect(x - radius + 44, y - radius + 44, (radius - 44) * 2, (radius - 44) * 2, 40);
  } else {
    g.fillStyle(GATE_DARK, 1);
    g.fillRoundedRect(x - radius + 12, y - radius + 12, (radius - 12) * 2, (radius - 12) * 2, 46);
    // 两扇合着的厚木门
    roundRect(g, x - radius + 10, y - radius + 18, radius - 12, (radius - 18) * 2, 14, THEME.wood, THEME.outline, 6);
    roundRect(g, x + 2, y - radius + 18, radius - 12, (radius - 18) * 2, 14, shade(THEME.wood, 0.94), THEME.outline, 6);
    // 门闩与门钉
    g.fillStyle(shade(THEME.woodDeep, 0.9), 1);
    g.fillRect(x - radius + 30, y - 40, radius * 2 - 60, 20);
    g.fillStyle(THEME.gold, 1);
    for (let i = 0; i < 4; i += 1) {
      g.fillCircle(x - 96 + i * 64, y - 74, 7);
      g.fillCircle(x - 96 + i * 64, y + 74, 7);
    }
    // 还没开门：外圈亮一圈金边（小手就放在这儿）
    const breathe = 0.5 + 0.5 * Math.sin(stage.elapsedMs / 300);
    g.lineStyle(10, THEME.gold, 0.3 + 0.35 * breathe);
    g.strokeRoundedRect(x - outer - 22, y - outer - 22, (outer + 22) * 2, (outer + 22) * 2, 76);
  }
}

/** 墙头上那面蒙着布的鼓（不敲 —— 息鼓） */
function drawDrum(g: Phaser.GameObjects.Graphics): void {
  const { x, y } = DRUM;
  groundShadow(g, x, y + 40, 96, 22, 0.3);
  roundRect(g, x - 44, y - 26, 88, 66, 18, shade(THEME.redDeep, 0.92), THEME.outline, 6);
  g.lineStyle(4, THEME.goldDeep, 0.85);
  g.lineBetween(x - 44, y + 2, x + 44, y + 2);
  // 蒙在鼓上的那块布
  roundRect(g, x - 52, y - 38, 104, 20, 9, shade(THEME.sand, 1.02), THEME.outline, 5);
}

/** 放倒的两面旗（偃旗）：旗杆躺在墙头上，旗面盖着 */
function drawFlags(g: Phaser.GameObjects.Graphics): void {
  for (const flag of FLAGS) {
    g.lineStyle(9, THEME.woodDeep, 1);
    g.lineBetween(flag.x - 54, flag.y + 16, flag.x + 70, flag.y - 6);
    g.fillStyle(shade(THEME.red, 0.94), 1);
    g.beginPath();
    g.moveTo(flag.x - 32, flag.y + 2);
    g.lineTo(flag.x + 44, flag.y - 14);
    g.lineTo(flag.x + 38, flag.y + 12);
    g.lineTo(flag.x - 36, flag.y + 28);
    g.closePath();
    g.fillPath();
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(flag.x - 32, flag.y + 2, flag.x + 44, flag.y - 14);
    g.lineBetween(flag.x + 44, flag.y - 14, flag.x + 38, flag.y + 12);
    g.lineBetween(flag.x + 38, flag.y + 12, flag.x - 36, flag.y + 28);
    g.lineBetween(flag.x - 36, flag.y + 28, flag.x - 32, flag.y + 2);
  }
}

// ---------------- 人 ----------------

/**
 * 赵云立在墙头上：白袍银甲，手里不拿兵器，眼睛就是两条平静的线 ——
 * 他一下都不动（手里那点小动作只在"你动了"的那一刻抖一下，用来告诉孩子"刚才那下算数"）。
 */
function drawZhaoyun(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  const flinch = stage.lastSlip === true ? clamp01(1 - stage.sinceActionMs / 520) : 0;
  const jitter = flinch * 6;
  const { x, y } = ZHAOYUN;
  groundShadow(g, x, y + 8, 140, 30, 0.28);
  // 白袍与银甲
  roundRect(g, x - 42 + jitter, y - 122, 84, 126, 28, ROBE, THEME.outline, 6);
  g.lineStyle(5, ROBE_DEEP, 1);
  for (let i = 0; i < 3; i += 1) {
    g.lineBetween(x - 34 + jitter, y - 96 + i * 30, x + 34 + jitter, y - 96 + i * 30);
  }
  // 头与盔
  circle(g, x + jitter, y - 156, 34, SKIN, THEME.outline, 6);
  roundRect(g, x - 38 + jitter, y - 202, 76, 28, 13, ROBE_DEEP, THEME.outline, 6);
  g.fillStyle(shade(ROBE_DEEP, 0.82), 1);
  g.fillEllipse(x + jitter, y - 214, 30, 24);
  // 眼睛：平平静静的两条线（他看他的，他不动他的）
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x - 20 + jitter, y - 158, x - 6 + jitter, y - 158);
  g.lineBetween(x + 6 + jitter, y - 158, x + 20 + jitter, y - 158);
  // 手：拢在身前（没有挥、没有指、没有拔剑）
  roundRect(g, x - 26 + jitter, y - 44, 52, 26, 12, shade(ROBE, 0.94), THEME.outline, 5);
  if (flinch > 0.05) {
    // 刚才那一下：手腕轻轻一紧
    g.lineStyle(6, THEME.redDeep, flinch * 0.9);
    g.lineBetween(x + 48 + jitter, y - 60, x + 66 + jitter, y - 80);
  }
}

/**
 * 来看虚实的曹军小校：
 * - 他盯着看的时候，从路那头走到营门正前方，火把举高、光往墙上扫；
 * - 他把目光移开的时候，转身退回路那一头；
 * - 你动的那一下，他这边会亮一下、头顶冒出个问号 —— 那就是"这一轮白忍了"。
 */
function drawScout(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  const toward = stage.phase === 'watch' || stage.phase === 'gate';
  const walk = ease(clamp01(stage.pulse * 3));
  const from = toward ? AWAY : WATCH;
  const to = toward ? WATCH : AWAY;
  const x = from.x + (to.x - from.x) * walk;
  const y = from.y + (to.y - from.y) * walk;
  const watching = stage.phase === 'watch' && walk > 0.55;
  const facing = toward ? -1 : 1;
  const notice = stage.lastSlip === true ? clamp01(1 - stage.sinceActionMs / 640) : 0;

  groundShadow(g, x, y + 76, 116, 30, 0.28);
  // 腿与身子
  g.lineStyle(20, THEME.outline, 1);
  g.lineBetween(x - 16, y + 40, x - 20, y + 76);
  g.lineBetween(x + 16, y + 40, x + 22, y + 76);
  roundRect(g, x - 42, y - 62, 84, 110, 26, SCOUT, THEME.outline, 6);
  g.lineStyle(6, SCOUT_DEEP, 1);
  g.lineBetween(x - 34, y - 20, x + 34, y - 20);
  // 头与头盔
  circle(g, x, y - 92, 33, SKIN, THEME.outline, 6);
  roundRect(g, x - 38, y - 132, 76, 32, 13, SCOUT_DEEP, THEME.outline, 6);
  g.fillStyle(SCOUT_DEEP, 1);
  g.fillEllipse(x, y - 142, 30, 22);
  if (watching) {
    // 目光往上：一双盯着墙头的眼睛
    g.fillStyle(THEME.outline, 1);
    g.fillCircle(x - 10, y - 96, 4.6);
    g.fillCircle(x + 10, y - 96, 4.6);
  } else {
    // 背过身去：只看得见后脑的一条线
    g.lineStyle(4, THEME.outline, 0.55);
    g.lineBetween(x - 8, y - 96, x + 8, y - 96);
  }
  // 手里的火把
  const lift = 40 + (watching ? 46 : 6) + notice * 14;
  const torchX = x + facing * 40;
  const torchY = y - 60 - lift;
  g.lineStyle(8, THEME.woodDeep, 1);
  g.lineBetween(x + facing * 26, y - 40, torchX, torchY);
  // 火把的光：盯着看的时候往墙上扫过去（那道扫过来的光就是"他在看你"）
  if (watching) {
    g.fillStyle(TORCH, 0.16 + notice * 0.2);
    g.beginPath();
    g.moveTo(torchX, torchY - 20);
    g.lineTo(GATE.x - 210, GATE.y - 230);
    g.lineTo(GATE.x + 250, GATE.y + 40);
    g.closePath();
    g.fillPath();
  }
  g.fillStyle(TORCH, 0.26 + notice * 0.4);
  g.fillCircle(torchX, torchY - 12, 38 + notice * 16);
  circle(g, torchX, torchY - 16, 16, TORCH, THEME.outline, 5);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(torchX, torchY - 34, torchX, torchY - 54);
  // 你动了的那一下：头顶冒出一个问号（他好像察觉了什么）
  if (notice > 0.05) {
    const qx = x + facing * -34;
    const qy = y - 196;
    g.lineStyle(8, THEME.paper, notice * 0.95);
    g.beginPath();
    g.arc(qx, qy, 18, Math.PI * 0.9, Math.PI * 2.1);
    g.strokePath();
    g.lineBetween(qx + 15, qy + 12, qx + 4, qy + 30);
    g.fillStyle(THEME.paper, notice * 0.95);
    g.fillCircle(qx + 2, qy + 46, 5);
  }
}

/** 动了那几下留下的记号：路上一排小石头 —— 记的是账，不是罚 */
function drawTally(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  const shown = Math.min(stage.slips, MAX_MARKS);
  for (let i = 0; i < shown; i += 1) {
    const mx = 76 + i * 46;
    const my = 1286 - (i % 2) * 12;
    g.fillStyle(shade(THEME.inkSoft, 1.05), 0.7);
    g.fillCircle(mx, my, 9);
  }
  if (stage.lastSlip === true && stage.sinceActionMs < 640 && shown > 0) {
    g.lineStyle(5, THEME.redDeep, clamp01(1 - stage.sinceActionMs / 640));
    g.strokeCircle(76 + (shown - 1) * 46, 1286 - ((shown - 1) % 2) * 12, 18);
  }
}

// ---------------- 每帧 ----------------

/** 每帧：暮色、汉水、营墙、大开（或关着）的营门、墙头上的赵云、举火把的曹军、那几笔账 */
export function drawWorld(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  drawSky(g, stage.elapsedMs);
  drawRiver(g, stage.elapsedMs);
  drawRoad(g);
  drawWall(g);
  drawGate(g, stage);
  drawDrum(g);
  drawFlags(g);
  drawZhaoyun(g, stage);
  drawScout(g, stage);
  drawTally(g, stage);
}

/** 成了：营门大开、他一下都没看见 —— 金光从门里漫出来，路上是他退走的脚印 */
export function drawFinale(g: Phaser.GameObjects.Graphics, stage: StillnessCalmStageState): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(GATE.x, GATE.y, 300);
  g.lineStyle(11, THEME.gold, 0.5);
  g.strokeCircle(GATE.x, GATE.y, 252);
  g.lineStyle(8, THEME.gold, 0.42);
  g.strokeCircle(ZHAOYUN.x, ZHAOYUN.y, 132);
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle(THEME.outline, 0.16);
    g.fillEllipse(WATCH.x + 40 + i * 68, WATCH.y + 30 + (i % 2) * 10, 32, 16);
  }
  void stage;
}

// ---------------- 分幕插图 ----------------

/** 插图里的一座小营门：closed 是两扇合着的门，open 是黑得看不见底的门洞 */
function drawMiniGate(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  s: number,
  open: boolean,
): void {
  const r = 92 * s;
  roundRect(g, cx - r - 12 * s, cy - r - 12 * s, (r + 12 * s) * 2, (r + 12 * s) * 2, 26 * s, shade(THEME.stone, 0.88), THEME.outline, 5);
  g.fillStyle(open ? GATE_DARK : THEME.wood, 1);
  g.fillRoundedRect(cx - r, cy - r, r * 2, r * 2, 20 * s);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(cx - r, cy - r, r * 2, r * 2, 20 * s);
  if (open) {
    g.fillStyle(THEME.paper, 0.06);
    g.fillRoundedRect(cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, 16 * s);
    return;
  }
  g.lineStyle(4, THEME.woodDeep, 1);
  g.lineBetween(cx, cy - r + 8 * s, cx, cy + r - 8 * s);
  g.fillStyle(shade(THEME.woodDeep, 0.9), 1);
  g.fillRect(cx - r + 14 * s, cy - 8 * s, r * 2 - 28 * s, 14 * s);
}

/** 插图里立在墙头上的一个人（简笔） */
function drawMiniMan(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  robe: number,
): void {
  groundShadow(g, x, y + 4 * s, 56 * s, 14 * s, 0.2);
  roundRect(g, x - 18 * s, y - 62 * s, 36 * s, 66 * s, 12 * s, robe, THEME.outline, 4 * s);
  circle(g, x, y - 80 * s, 15 * s, SKIN, THEME.outline, 4 * s);
  g.lineStyle(3 * s, THEME.outline, 1);
  g.lineBetween(x - 8 * s, y - 81 * s, x - 3 * s, y - 81 * s);
  g.lineBetween(x + 3 * s, y - 81 * s, x + 8 * s, y - 81 * s);
}

/** 分幕插图：① 曹军大队压到营前 ② 营门大开，他站在门口犹豫 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(DUSK, 1.06), 1);
  g.fillRoundedRect(x, y, w, h * 0.46, 30);
  g.fillStyle(EARTH, 1);
  g.fillRoundedRect(x, y + h * 0.44, w, h * 0.56, 30);
  // 插图上的一道营墙（两幕共用）
  g.fillStyle(WALL, 1);
  g.fillRect(x + w * 0.08, y + h * 0.44, w * 0.84, h * 0.16);
  g.lineStyle(5, THEME.outline, 0.8);
  g.strokeRect(x + w * 0.08, y + h * 0.44, w * 0.84, h * 0.16);

  if (index === 0) {
    // ① 曹军压过来：一排举着长矛的人 + 一面大旗（营里的人少，门还关着）
    drawMiniGate(g, x + w * 0.32, y + h * 0.66, 0.46, false);
    drawMiniMan(g, x + w * 0.2, y + h * 0.6, 0.62, ROBE);
    g.lineStyle(7, THEME.woodDeep, 1);
    g.lineBetween(x + w * 0.62, y + h * 0.88, x + w * 0.62, y + h * 0.2);
    g.fillStyle(shade(SCOUT, 0.86), 1);
    g.beginPath();
    g.moveTo(x + w * 0.62, y + h * 0.22);
    g.lineTo(x + w * 0.88, y + h * 0.28);
    g.lineTo(x + w * 0.62, y + h * 0.4);
    g.closePath();
    g.fillPath();
    for (let i = 0; i < 6; i += 1) {
      const sx = x + w * (0.66 + (i % 3) * 0.11);
      const sy = y + h * (0.6 + Math.floor(i / 3) * 0.15);
      drawMiniMan(g, sx, sy, 0.62, SCOUT);
      // 长矛
      g.lineStyle(5, THEME.woodDeep, 1);
      g.lineBetween(sx + 14, sy - 46, sx + 22, sy + 10);
      g.fillStyle(THEME.stoneDeep, 1);
      g.fillTriangle(sx + 18, sy - 62, sx + 28, sy - 44, sx + 8, sy - 46);
    }
    return;
  }

  // ② 营门大开：门里黑着，赵云立在墙头上，曹军在门口犹豫（一个大问号）
  drawMiniGate(g, x + w * 0.36, y + h * 0.68, 0.56, true);
  drawMiniMan(g, x + w * 0.2, y + h * 0.44, 0.72, ROBE);
  // 放倒的旗
  g.lineStyle(6, THEME.woodDeep, 1);
  g.lineBetween(x + w * 0.5, y + h * 0.46, x + w * 0.72, y + h * 0.42);
  // 门口犹豫的那个人
  drawMiniMan(g, x + w * 0.66, y + h * 0.82, 0.66, SCOUT);
  const qx = x + w * 0.78;
  const qy = y + h * 0.56;
  g.lineStyle(8, THEME.inkSoft, 0.95);
  g.beginPath();
  g.arc(qx, qy, 20, Math.PI * 0.9, Math.PI * 2.1);
  g.strokePath();
  g.lineBetween(qx + 17, qy + 12, qx + 5, qy + 30);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillCircle(qx + 3, qy + 48, 5.5);
}
