import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { ChaseStageState } from '@chags/templates';
import type { ChaseLevel } from '@chags/templates/schemas';
import {
  BAR_RADIUS, HOLD, PATH, PROGRESS, PURSUER, RIDGES, RULER, RUNNER, SKY_TOP, STAMINA,
  runnerScale, runnerX,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const SKIN = 0xf6d3ae;

/** 山脊：一条折线画到底（不用曲线，免得依赖曲线 API） */
function drawRidge(
  g: Phaser.GameObjects.Graphics,
  baseY: number,
  color: number,
  peaks: readonly number[],
): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(-40, H);
  const step = (W + 80) / (peaks.length - 1);
  peaks.forEach((peak, index) => {
    const x = -40 + step * index;
    const y = baseY - peak;
    const midX = x - step / 2;
    if (index > 0) g.lineTo(midX, baseY - peak * 0.35);
    g.lineTo(x, y);
  });
  g.lineTo(W + 40, H);
  g.closePath();
  g.fillPath();
}

/** 路边的松树：一条杆 + 三层三角 */
function drawPine(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  groundShadow(g, x, y + 6 * s, 92 * s, 22 * s, 0.16);
  roundRect(g, x - 10 * s, y - 60 * s, 20 * s, 66 * s, 8 * s, THEME.woodDeep, THEME.outline, 5 * s);
  for (let i = 0; i < 3; i += 1) {
    const cy = y - (70 + i * 52) * s;
    const half = (86 - i * 18) * s;
    g.fillStyle(shade(THEME.leaf, 0.94 - i * 0.06), 1);
    g.fillTriangle(x - half, cy, x + half, cy, x, cy - 78 * s);
    g.lineStyle(5 * s, THEME.outline, 1);
    g.strokeTriangle(x - half, cy, x + half, cy, x, cy - 78 * s);
  }
}

/** 暮色、两重山、一条土路与几棵树 —— 画一次 */
export function drawWorld(g: Phaser.GameObjects.Graphics): void {
  // 天：从上到下慢慢暖起来
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  g.fillStyle(THEME.skyDeep, 0.5);
  g.fillRect(0, SKY_TOP, W, 150);
  // 落日
  circle(g, 592, 420, 78, THEME.gold, THEME.outline, 6);
  g.fillStyle(THEME.paper, 0.35);
  g.fillCircle(566, 396, 26);

  drawRidge(g, RIDGES[0].y + 130, shade(THEME.teal, 0.72), [120, 210, 96, 250, 140, 190]);
  drawRidge(g, RIDGES[1].y + 150, shade(THEME.teal, 0.94), [90, 150, 200, 120, 170]);

  // 山道：一条从左边爬到右边的土路（上缘是斜的，才像山路）
  g.fillStyle(THEME.sand, 1);
  g.beginPath();
  g.moveTo(PATH.left, PATH.top + 90);
  g.lineTo(PATH.right, PATH.top - 40);
  g.lineTo(PATH.right, PATH.bottom);
  g.lineTo(PATH.left, PATH.bottom);
  g.closePath();
  g.fillPath();
  g.lineStyle(7, THEME.outline, 0.25);
  g.lineBetween(PATH.left, PATH.top + 90, PATH.right, PATH.top - 40);
  g.fillStyle(shade(THEME.sand, 0.9), 0.7);
  g.fillRect(PATH.left, PATH.bottom - 90, W + 40, 90);

  drawPine(g, 60, 792, 0.9);
  drawPine(g, 700, 770, 0.78);

  // 两条槽的底槽与距离刻度的底槽（数值每帧画在 drawStage 里）
  for (const bar of [STAMINA, PROGRESS, RULER] as const) {
    roundRect(g, bar.x, bar.y, bar.w, bar.h, bar.h / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  }

  // 按住追的那颗大按钮：不写字，用两个"往前追"的箭头说
  circle(g, HOLD.x, HOLD.y, HOLD.radius + 8, shade(THEME.card, 0.9), THEME.outline, 5);
  circle(g, HOLD.x, HOLD.y, HOLD.radius, THEME.red, THEME.outline, 7);
  for (const [dx, scale] of [[-28, 1], [34, 1.12]] as const) {
    g.fillStyle(THEME.paper, 1);
    g.fillTriangle(
      HOLD.x + dx - 30 * scale, HOLD.y - 46 * scale,
      HOLD.x + dx + 30 * scale, HOLD.y,
      HOLD.x + dx - 30 * scale, HOLD.y + 46 * scale,
    );
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(
      HOLD.x + dx - 30 * scale, HOLD.y - 46 * scale,
      HOLD.x + dx + 30 * scale, HOLD.y,
      HOLD.x + dx - 30 * scale, HOLD.y + 46 * scale,
    );
  }
}

/** 追的人（诸葛亮）：站在左边，一只手往前伸，脚下一圈土 */
function drawPursuer(g: Phaser.GameObjects.Graphics, forward: boolean): void {
  const { x, y } = PURSUER;
  groundShadow(g, x, y + 8, 150, 30, 0.18);
  roundRect(g, x - 40, y - 150, 80, 158, 30, shade(THEME.teal, 0.92), THEME.outline, 6);
  g.fillStyle(THEME.card, 1);
  g.fillTriangle(x - 22, y - 148, x + 22, y - 148, x, y - 104);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 22, y - 148, x + 22, y - 148, x, y - 104);
  circle(g, x, y - 182, 34, SKIN, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 196, 72, 30);
  // 伸出去的那只手：按住了就伸得更直（"追"的意思全在这一条胳膊上）
  const reach = forward ? 108 : 78;
  g.lineStyle(16, shade(THEME.teal, 0.86), 1);
  g.lineBetween(x + 34, y - 130, x + reach, y - 112);
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x + 34, y - 130, x + reach, y - 112);
  circle(g, x + reach, y - 108, 18, SKIN, THEME.outline, 5);
}

/**
 * 跑的人（孟获）：scale 越小就是拉得越远；turned = 逼太近了，他回头
 * （回头只是"看见你了"，画面里没有任何打斗）
 */
function drawRunner(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  turned: boolean,
  tired: number,
): void {
  groundShadow(g, x, y + 6 * scale, 130 * scale, 26 * scale, 0.16);
  // 两条腿：跑着的样子（tired 越大越站不直 —— 他是"自己慢下来"的）
  const spread = (1 - tired * 0.55) * 26 * scale;
  for (const dir of [-1, 1] as const) {
    roundRect(g, x + dir * spread - 9 * scale, y - 58 * scale, 18 * scale, 62 * scale, 8 * scale, THEME.woodDeep, THEME.outline, 5 * scale);
  }
  roundRect(g, x - 34 * scale, y - 146 * scale, 68 * scale, 96 * scale, 26 * scale, shade(THEME.gold, 0.98), THEME.outline, 6 * scale);
  g.fillStyle(THEME.card, 1);
  g.fillTriangle(x - 18 * scale, y - 144 * scale, x + 18 * scale, y - 144 * scale, x, y - 108 * scale);
  g.lineStyle(4 * scale, THEME.outline, 1);
  g.strokeTriangle(x - 18 * scale, y - 144 * scale, x + 18 * scale, y - 144 * scale, x, y - 108 * scale);
  // 手：回头的时候两只手都张着（"别过来"），否则一前一后摆着
  if (turned) {
    for (const dir of [-1, 1] as const) {
      g.lineStyle(12 * scale, shade(THEME.gold, 0.88), 1);
      g.lineBetween(x + dir * 26 * scale, y - 128 * scale, x + dir * 62 * scale, y - 156 * scale);
      circle(g, x + dir * 64 * scale, y - 158 * scale, 14 * scale, SKIN, THEME.outline, 4 * scale);
    }
  } else {
    g.lineStyle(12 * scale, shade(THEME.gold, 0.88), 1);
    g.lineBetween(x + 22 * scale, y - 128 * scale, x + 58 * scale, y - 104 * scale);
    g.lineBetween(x - 22 * scale, y - 128 * scale, x - 54 * scale, y - 154 * scale);
  }
  // 头：turned 的时候脸转向左边（追的人那一边）
  const headX = x + (turned ? -8 * scale : 0);
  circle(g, headX, y - 176 * scale, 32 * scale, SKIN, THEME.outline, 6 * scale);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(headX, y - 190 * scale, 68 * scale, 30 * scale);
  for (const dir of [-1, 1] as const) {
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(headX + dir * 11 * scale + (turned ? -6 * scale : 0), y - 176 * scale, 9 * scale, 12 * scale);
  }
  if (turned) {
    // 回头的一瞬：眉头压下来 + 两笔红（儿童化的"不高兴"，不是打斗）
    g.lineStyle(6 * scale, THEME.outline, 1);
    g.lineBetween(headX - 20 * scale, y - 194 * scale, headX - 4 * scale, y - 188 * scale);
    g.lineBetween(headX + 4 * scale, y - 188 * scale, headX + 20 * scale, y - 194 * scale);
    for (const dir of [-1, 1] as const) {
      g.lineStyle(7 * scale, THEME.red, 0.9);
      g.lineBetween(x + dir * 44 * scale, y - 214 * scale, x + dir * 62 * scale, y - 232 * scale);
    }
  }
}

/** 一条槽：ratio 部分填色（体力条与进度条共用） */
function drawBar(
  g: Phaser.GameObjects.Graphics,
  bar: { x: number; y: number; w: number; h: number },
  ratio: number,
  color: number,
): void {
  const inner = bar.h - 12;
  const fill = inner * Math.max(0, Math.min(1, ratio));
  if (fill <= 6) return;
  roundRect(
    g,
    bar.x + 6,
    bar.y + 6 + (inner - fill),
    bar.w - 12,
    fill,
    Math.min(BAR_RADIUS, fill / 2),
    color,
    null,
    0,
  );
}

/** 距离刻度：绿色的就是"要维持的区间"，白点是我们此刻在哪儿 */
function drawRuler(g: Phaser.GameObjects.Graphics, level: ChaseLevel, distance: number): void {
  const { x, y, w, h } = RULER;
  const span = level.keepMax - level.keepMin;
  const bandX = x + 8 + ((w - 16) * level.keepMin) / 100;
  const bandW = ((w - 16) * span) / 100;
  roundRect(g, bandX, y + 7, Math.max(10, bandW), h - 14, (h - 14) / 2, THEME.leaf, null, 0);
  for (const edge of [level.keepMin, level.keepMax] as const) {
    const ex = x + 8 + ((w - 16) * edge) / 100;
    g.lineStyle(4, shade(THEME.leaf, 0.72), 1);
    g.lineBetween(ex, y + 4, ex, y + h - 4);
  }
  const px = x + 8 + ((w - 16) * Math.max(0, Math.min(100, distance))) / 100;
  circle(g, px, y + h / 2, 15, THEME.card, THEME.outline, 5);
  circle(g, px, y + h / 2, 8, THEME.red, null, 0);
}

/** 每帧：两个人影、体力、这段追逐的进度、距离刻度 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: ChaseStageState,
  level: ChaseLevel,
): void {
  const rx = runnerX(state.distance);
  const scale = runnerScale(state.distance);
  const tired = 1 - Math.max(0, Math.min(1, state.stamina));

  drawPursuer(g, state.holding);
  drawRunner(g, rx, RUNNER.y, scale, state.band === 'tooClose', tired);
  // 跟丢了：他越走越远，身后一层沙尘（进度退，人影小）
  if (state.band === 'tooFar') {
    g.fillStyle(THEME.sandDeep, 0.5);
    for (let i = 0; i < 3; i += 1) {
      g.fillCircle(rx + 40 + i * 34, RUNNER.y - 10 - i * 12, 14 - i * 3);
    }
  }

  drawBar(g, STAMINA, state.stamina, state.done ? THEME.gold : THEME.red);
  drawBar(g, PROGRESS, state.progress, state.band === 'tooFar' ? THEME.stoneDeep : THEME.teal);
  drawRuler(g, level, state.distance);

  // 按住了：按钮下沉一层，追的人那只手伸得更直
  if (state.holding) {
    circle(g, HOLD.x, HOLD.y + 9, HOLD.radius, shade(THEME.red, 0.82), THEME.outline, 7);
  }
  if (state.done) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse((PURSUER.x + rx) / 2, RUNNER.y - 90, 720, 460);
  }
}

/** 收尾：他停下来了 —— 不是被抓住，是自己心服（两个人对着，中间一道金色的弧） */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _state: ChaseStageState,
  level: ChaseLevel,
): void {
  const rx = runnerX(level.keepMax);
  g.fillStyle(THEME.gold, 0.18);
  g.fillEllipse(W / 2, RUNNER.y - 120, 900, 620);
  g.lineStyle(10, THEME.gold, 0.6);
  g.beginPath();
  g.moveTo(PURSUER.x + 120, PURSUER.y - 150);
  g.lineTo((PURSUER.x + rx) / 2, PURSUER.y - 300);
  g.lineTo(rx - 60, RUNNER.y - 190);
  g.strokePath();
  drawPursuer(g, false);
  drawRunner(g, rx, RUNNER.y, 1, false, 1);
  for (const [px, py] of [[rx - 30, RUNNER.y - 250], [rx + 30, RUNNER.y - 232]] as const) {
    circle(g, px, py, 10, THEME.gold, THEME.outline, 4);
  }
}

/** 分幕插图：① 追得太紧，他回头 ② 绳子松了松，他自己慢下来 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.gold, 1.02), 0.5);
  g.fillCircle(x + w * 0.86, y + h * 0.14, 56);
  g.fillStyle(THEME.sand, 1);
  g.fillRoundedRect(x - 20, y + h * 0.6, w + 40, h * 0.42, 30);
  g.lineStyle(6, THEME.outline, 0.2);
  g.lineBetween(x - 20, y + h * 0.62, x + w + 20, y + h * 0.55);

  const groundY = y + h * 0.82;
  if (index === 0) {
    // ① 追得太紧：两个人挨得很近，前面那个回头皱眉头
    drawRunner(g, x + w * 0.46, groundY, 0.62, true, 0);
    // 后面那个追的人（缩小版，只画身子与伸手）
    const px = x + w * 0.24;
    roundRect(g, px - 30, groundY - 116, 60, 122, 24, shade(THEME.teal, 0.92), THEME.outline, 6);
    circle(g, px, groundY - 142, 26, SKIN, THEME.outline, 5);
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(px, groundY - 152, 54, 22);
    g.lineStyle(13, shade(THEME.teal, 0.86), 1);
    g.lineBetween(px + 24, groundY - 100, px + 94, groundY - 86);
    for (const dy of [0, 40] as const) {
      g.lineStyle(7, THEME.red, 0.85);
      g.lineBetween(x + w * 0.6, groundY - 240 + dy, x + w * 0.68, groundY - 258 + dy);
    }
    return;
  }
  // ② 隔着一段跟着：他慢下来了（尘土落地、步子收了）
  drawRunner(g, x + w * 0.68, groundY, 0.62, false, 0.7);
  const px = x + w * 0.2;
  roundRect(g, px - 30, groundY - 116, 60, 122, 24, shade(THEME.teal, 0.92), THEME.outline, 6);
  circle(g, px, groundY - 142, 26, SKIN, THEME.outline, 5);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(px, groundY - 152, 54, 22);
  g.lineStyle(12, shade(THEME.teal, 0.86), 1);
  g.lineBetween(px + 24, groundY - 100, px + 78, groundY - 118);
  // 中间那条"距离"：一段虚线，说明隔着
  g.lineStyle(6, THEME.leaf, 0.9);
  for (let i = 0; i < 4; i += 1) {
    const lx = x + w * (0.36 + i * 0.07);
    g.lineBetween(lx, groundY - 60, lx + 22, groundY - 60);
  }
}
