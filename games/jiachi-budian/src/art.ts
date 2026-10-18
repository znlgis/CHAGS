import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { StillnessFeignStageState } from '@chags/templates';
import { ACTION, AWAY, GROUND_TOP, MAX_MARKS, SKY_TOP, STEPS, SUNBIN, WALL_TOP, WATCH } from './layout';
import { clamp01 } from '@chags/game-kit';

const W = DESIGN.width;
const H = DESIGN.height;
const DUSK = 0x3a4766;
const DUSK_DEEP = 0x27314b;
const WALL = 0x7c6b52;
const WALL_DEEP = 0x5d4f3c;
const EARTH = 0x6f5c46;
const EARTH_LIGHT = 0x8a7459;
const SKIN = 0xf8dcbb;
const ROBE = 0x9aa7bf;
const ROBE_DEEP = 0x6f7d99;
const SCOUT = 0x4a5568;
/** 平滑一步（走位用它，别一顿一顿的） */
const ease = (t: number): number => t * t * (3 - 2 * t);

// ---------------- 景 ----------------

/** 暮色：天还没全黑，几颗星已经出来了 */
function drawSky(g: Phaser.GameObjects.Graphics, t: number): void {
  g.fillStyle(DUSK, 1);
  g.fillRect(0, SKY_TOP, W, WALL_TOP - SKY_TOP);
  g.fillStyle(DUSK_DEEP, 0.45);
  g.fillRect(0, SKY_TOP, W, 70);
  for (let i = 0; i < 10; i += 1) {
    const sx = 40 + ((i * 173) % 660);
    const sy = SKY_TOP + 26 + ((i * 41) % 80);
    g.fillStyle(THEME.paper, 0.25 + 0.3 * Math.sin(t / 800 + i));
    g.fillCircle(sx, sy, 3.5);
  }
}

/** 院墙与院子：一道土墙，墙里是夯土的地面 */
function drawCourt(g: Phaser.GameObjects.Graphics, t: number): void {
  // 院墙：墙头加一层瓦
  g.fillStyle(WALL_DEEP, 1);
  g.fillRect(0, WALL_TOP, W, GROUND_TOP - WALL_TOP);
  g.fillStyle(WALL, 1);
  g.fillRect(0, WALL_TOP + 14, W, GROUND_TOP - WALL_TOP - 22);
  g.fillStyle(shade(THEME.stoneDeep, 1.15), 1);
  g.fillRect(0, WALL_TOP - 10, W, 24);
  g.fillStyle(THEME.stoneDeep, 1);
  for (let i = 0; i < 13; i += 1) {
    g.fillCircle(28 + i * 58, WALL_TOP - 10, 15);
  }
  // 墙根下的一道影子，让墙与地分得开
  g.fillStyle(THEME.outline, 0.14);
  g.fillRect(0, GROUND_TOP - 16, W, 20);

  // 夯土的院子
  g.fillStyle(EARTH, 1);
  g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  g.fillStyle(EARTH_LIGHT, 0.55);
  g.fillRect(0, GROUND_TOP, W, 46);
  // 地上几道扫过的痕迹
  for (let i = 0; i < 5; i += 1) {
    const y = GROUND_TOP + 120 + i * 150;
    g.lineStyle(5, shade(EARTH, 0.86), 0.5);
    g.lineBetween(40 + ((i * 90) % 120), y, W - 60 - ((i * 70) % 140), y + 16);
  }
  // 墙角的一只水罐（院子里的家常东西）
  circle(g, 96, 972, 46, shade(THEME.stone, 0.92), THEME.outline, 6);
  circle(g, 96, 936, 24, shade(THEME.stone, 0.8), THEME.outline, 5);
  void t;
}

// ---------------- 人 ----------------

/**
 * 孙膑：坐在席子上，头发散着、眼神放空 —— **装糊涂不是骗人，是忍**。
 * 空档里他的袖子会轻轻动一下（在竹简上记东西）：动的方向由 phase 给。
 */
function drawSunBin(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  const { x, y } = SUNBIN;
  const flinch = stage.lastSlip === true ? clamp01(1 - stage.sinceActionMs / 420) : 0;
  const jitter = flinch * 7;
  groundShadow(g, x, y + 74, 168, 40, 0.26);

  // 席子
  g.fillStyle(shade(THEME.sandDeep, 0.94), 1);
  g.fillEllipse(x, y + 76, 216, 58);
  g.lineStyle(5, THEME.outline, 0.6);
  g.strokeEllipse(x, y + 76, 216, 58);

  // 盘着的腿与袍子
  roundRect(g, x - 66 + jitter, y + 2, 132, 78, 30, ROBE_DEEP, THEME.outline, 6);
  // 身子
  roundRect(g, x - 52 + jitter, y - 74, 104, 96, 30, ROBE, THEME.outline, 6);
  // 空档里：袖子轻轻一动，在竹简上记一笔
  const writing = stage.phase === 'gap' ? Math.sin(stage.elapsedMs / 150) * 9 : 0;
  roundRect(g, x + 24 + jitter, y - 16 + writing, 74, 34, 16, shade(ROBE, 0.9), THEME.outline, 5);
  // 头：头发散着（装糊涂的样子），眼睛是两条放空的线
  circle(g, x + jitter, y - 116, 42, SKIN, THEME.outline, 6);
  g.fillStyle(shade(THEME.inkSoft, 1.05), 1);
  g.beginPath();
  g.moveTo(x - 44 + jitter, y - 116);
  g.lineTo(x - 30 + jitter, y - 176);
  g.lineTo(x + 44 + jitter, y - 158);
  g.lineTo(x + 40 + jitter, y - 96);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, THEME.outline, 1);
  g.strokeCircle(x + jitter, y - 116, 42);
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x - 24 + jitter, y - 118, x - 6 + jitter, y - 118);
  g.lineBetween(x + 8 + jitter, y - 118, x + 26 + jitter, y - 118);
  // 露馅那一下：一缕头发抖一下、嘴边一撇"哎呀"
  if (flinch > 0.05) {
    g.lineStyle(6, THEME.redDeep, flinch);
    g.lineBetween(x + 62 + jitter, y - 176, x + 78 + jitter, y - 198);
  }
}

/** 魏兵：举着灯笼来试探（test），还是背过身走到一边（gap） */
function drawScout(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  // 走位：每一段的前三成时间在走，其余时间站定 —— 走开的那一下看得见
  const walk = ease(clamp01(stage.pulse * 3));
  const watching = stage.phase !== 'gap';
  const x = watching ? AWAY.x + (WATCH.x - AWAY.x) * walk : WATCH.x + (AWAY.x - WATCH.x) * walk;
  const y = (watching ? AWAY.y : WATCH.y) + (watching ? (WATCH.y - AWAY.y) * walk : (AWAY.y - WATCH.y) * walk);
  const facing = watching ? -1 : 1;

  groundShadow(g, x, y + 84, 120, 32, 0.26);
  // 腿与身子
  g.lineStyle(20, THEME.outline, 1);
  g.lineBetween(x - 16, y + 44, x - 20, y + 84);
  g.lineBetween(x + 16, y + 44, x + 22, y + 84);
  roundRect(g, x - 44, y - 66, 88, 116, 26, SCOUT, THEME.outline, 6);
  // 头与头盔
  circle(g, x, y - 96, 34, SKIN, THEME.outline, 6);
  roundRect(g, x - 40, y - 136, 80, 34, 14, shade(SCOUT, 0.82), THEME.outline, 6);
  g.fillStyle(THEME.outline, 1);
  if (watching) {
    g.fillCircle(x - 10, y - 96, 4.5);
    g.fillCircle(x + 10, y - 96, 4.5);
  } else {
    // 背过身去：只看得见后脑勺的一条线
    g.lineStyle(4, THEME.outline, 0.55);
    g.lineBetween(x - 8, y - 96, x + 8, y - 96);
  }
  // 灯笼：试探时举高、光照过来；走开时提在身侧
  const lanternX = x + facing * (watching ? 62 : -34);
  const lanternY = y + (watching ? -118 : -10);
  if (watching) {
    // 光锥：从灯笼照向孙膑
    g.fillStyle(THEME.gold, 0.2);
    g.beginPath();
    g.moveTo(lanternX, lanternY);
    g.lineTo(SUNBIN.x - 96, SUNBIN.y - 150);
    g.lineTo(SUNBIN.x - 30, SUNBIN.y + 110);
    g.closePath();
    g.fillPath();
  }
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x + facing * 26, y - 40, lanternX, lanternY - 20);
  circle(g, lanternX, lanternY, 30, watching ? THEME.gold : shade(THEME.goldDeep, 0.9), THEME.outline, 6);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(lanternX, lanternY - 30, lanternX, lanternY - 52);
}

// ---------------- 悄悄动手的地方 ----------------

/** 竹简案：推进几步，案上就有几片竹简亮起来 */
function drawDesk(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  const { x, y, radius } = ACTION;
  // 案腿与案面
  roundRect(g, x - radius + 24, y - 18, 18, 118, 8, THEME.woodDeep, THEME.outline, 5);
  roundRect(g, x + radius - 42, y - 18, 18, 118, 8, THEME.woodDeep, THEME.outline, 5);
  roundRect(g, x - radius, y - 46, radius * 2, 44, 16, THEME.wood, THEME.outline, 6);
  // 案上的竹简：推进一步亮一片
  const span = Math.max(1, STEPS);
  const step = (radius * 2 - 60) / span;
  for (let i = 0; i < STEPS; i += 1) {
    const done = i < stage.progress;
    const sx = x - radius + 40 + i * step;
    roundRect(
      g,
      sx,
      y - 40,
      Math.max(24, step - 12),
      32,
      9,
      done ? THEME.gold : shade(THEME.sand, 0.86),
      THEME.outline,
      5,
    );
  }
  // 案角的一小卷竹简
  circle(g, x + radius - 8, y - 12, 20, shade(THEME.sandDeep, 1.05), THEME.outline, 5);
}

/** 露馅留下的记号：一排小沙点 —— 记的是账，不是罚 */
function drawTally(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  const shown = Math.min(stage.slips, MAX_MARKS);
  for (let i = 0; i < shown; i += 1) {
    const mx = 92 + i * 44;
    const my = 1268 - (i % 2) * 12;
    g.fillStyle(shade(THEME.inkSoft, 1.05), 0.8);
    g.fillCircle(mx, my, 9);
  }
  // 还是忍不住的那一下：最后一个点闪一下
  if (stage.lastSlip === true && stage.sinceActionMs < 600) {
    g.lineStyle(5, THEME.redDeep, clamp01(1 - stage.sinceActionMs / 600));
    g.strokeCircle(92 + (shown - 1) * 44, 1268 - ((shown - 1) % 2) * 12, 18);
  }
}

// ---------------- 每帧 ----------------

/** 每帧：暮色、院墙、孙膑、举灯笼的魏兵、竹简案、那几笔账 */
export function drawFeign(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  drawSky(g, stage.elapsedMs);
  drawCourt(g, stage.elapsedMs);
  drawDesk(g, stage);
  drawSunBin(g, stage);
  drawScout(g, stage);
  drawTally(g, stage);
}

/** 成了：孙膑这一小段安静里把该记的都记下了 —— 金光从竹简案上起来 */
export function drawFeignFinale(g: Phaser.GameObjects.Graphics, stage: StillnessFeignStageState): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(ACTION.x, ACTION.y - 30, 240);
  g.lineStyle(10, THEME.gold, 0.55);
  g.strokeCircle(ACTION.x, ACTION.y - 30, 196);
  g.lineStyle(8, THEME.gold, 0.4);
  g.strokeCircle(SUNBIN.x, SUNBIN.y, 150);
  void stage;
}

// ---------------- 分幕插图 ----------------

/** 分幕插图：① 举着灯笼的魏兵站在席子边上 ② 空档里，他悄悄把见闻记在竹简上 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.card, 0.99), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(DUSK, 1.08), 1);
  g.fillRoundedRect(x, y, w, h * 0.42, 30);
  g.fillStyle(shade(EARTH, 1.1), 1);
  g.fillRoundedRect(x, y + h * 0.42, w, h * 0.58, 30);

  const cx = x + w / 2;
  const cy = y + h * 0.62;
  // 席子与坐着的人（两幕都用同一套画法，第二幕多一片竹简）
  groundShadow(g, cx - w * 0.16, cy + 60, 150, 34, 0.24);
  g.fillStyle(shade(THEME.sandDeep, 0.94), 1);
  g.fillEllipse(cx - w * 0.16, cy + 60, 190, 50);
  roundRect(g, cx - w * 0.16 - 46, cy - 40, 92, 96, 26, ROBE_DEEP, THEME.outline, 6);
  circle(g, cx - w * 0.16, cy - 78, 36, SKIN, THEME.outline, 6);
  g.fillStyle(shade(THEME.inkSoft, 1.05), 1);
  g.beginPath();
  g.moveTo(cx - w * 0.16 - 38, cy - 78);
  g.lineTo(cx - w * 0.16 - 26, cy - 128);
  g.lineTo(cx - w * 0.16 + 38, cy - 112);
  g.lineTo(cx - w * 0.16 + 34, cy - 60);
  g.closePath();
  g.fillPath();

  if (index === 0) {
    // ① 魏兵举着灯笼站在旁边（光斜斜地照过来）
    const sx = cx + w * 0.26;
    g.fillStyle(THEME.gold, 0.22);
    g.beginPath();
    g.moveTo(sx - 30, cy - 150);
    g.lineTo(cx - w * 0.16 + 60, cy - 40);
    g.lineTo(cx - w * 0.16 + 60, cy + 70);
    g.closePath();
    g.fillPath();
    roundRect(g, sx - 34, cy - 60, 68, 110, 22, SCOUT, THEME.outline, 6);
    circle(g, sx, cy - 92, 30, SKIN, THEME.outline, 6);
    roundRect(g, sx - 36, cy - 130, 72, 30, 12, shade(SCOUT, 0.82), THEME.outline, 6);
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(sx - 20, cy - 30, sx - 62, cy - 130);
    circle(g, sx - 66, cy - 146, 26, THEME.gold, THEME.outline, 6);
    return;
  }

  // ② 空档里：他把见闻一片片写在竹简上
  roundRect(g, cx + w * 0.1, cy + 10, w * 0.3, 34, 12, THEME.wood, THEME.outline, 6);
  for (let i = 0; i < 3; i += 1) {
    roundRect(g, cx + w * 0.12 + i * 42, cy - 16, 32, 30, 8, THEME.gold, THEME.outline, 5);
  }
}
