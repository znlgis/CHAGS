import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { StillnessStageState } from '@chags/templates';
import type { StillnessBeat } from '@chags/templates/schemas';

/**
 * 长勺战场的一屏剪影：**没有兵器特写、没有流血** ——
 * 两军只是站着，齐军擂鼓，鼓面一圈圈波纹推过来，鲁军按着不动。
 * 三通鼓敲完，对面就没劲了：士兵的肩往下塌、鼓面也哑了。
 */

/** 标题条下面才是画面 */
const TOP = 150;
/** 远处的山脊线：两军都站在这条线下面的地上 */
export const RIDGE_Y = 760;
/** 齐军站的地方（对面，左边） */
export const ENEMY_FEET_Y = 862;
/** 我军站的地方（这边，右边） */
export const OUR_FEET_Y = 906;
/** 敌军阵前的三面鼓：一通鼓一面 */
export const DRUM = { y: 966, r: 52, xs: [80, 185, 290] } as const;
export const ENEMY_XS = [56, 130, 204, 278] as const;
export const OUR_XS = [470, 546, 622, 698] as const;
/** 大地的颜色：剪影要站得住 */
const EARTH = 0x8b7a5c;
const ENEMY_INK = 0x5b6478;
const OUR_INK = 0x7c5a48;

/** 一个站着的人（头盔 + 圆脑袋 + 圆肩膀），lean 往前倾、droop 塌肩膀 */
function drawSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  feetY: number,
  color: number,
  opts: { lean?: number; droop?: number; scale?: number } = {},
): void {
  const scale = opts.scale ?? 1;
  const lean = opts.lean ?? 0;
  const droop = opts.droop ?? 0;
  const bodyH = (74 - droop * 16) * scale;
  const bodyW = 62 * scale;
  const headR = 25 * scale;
  const headY = feetY - bodyH - headR + droop * 6 * scale;

  groundShadow(g, x, feetY + 6 * scale, bodyW * 1.5, 16 * scale, 0.14);
  roundRect(
    g,
    x - bodyW / 2 + lean,
    feetY - bodyH,
    bodyW,
    bodyH,
    bodyW / 2.4,
    color,
    THEME.outline,
    5,
  );
  circle(g, x + lean * 1.4, headY, headR, color, THEME.outline, 5);
  // 头盔：一个小圆顶，让剪影看得出是人
  g.fillStyle(shade(color, 1.12), 1);
  g.fillEllipse(x + lean * 1.4, headY - headR * 0.42, headR * 2.1, headR * 1.1);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x + lean * 1.4, headY - headR * 0.42, headR * 2.1, headR * 1.1);
}

/** 一面鼓：鼓面朝外，木架撑着；active 时波纹一圈圈推出去 */
function drawDrum(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  mark: 'rest' | 'drum' | 'window' | 'passed',
  ripple: number,
): void {
  const dim = mark === 'passed' ? 0.55 : 1;
  const face = mark === 'drum' ? 0xffe6b0 : THEME.paperDeep;
  groundShadow(g, x, y + r + 26, r * 2.2, 18, 0.16);
  // 木架
  g.lineStyle(9, shade(THEME.woodDeep, dim), 1);
  g.lineBetween(x - r * 0.5, y + r * 0.7, x - r * 0.7, y + r + 26);
  g.lineBetween(x + r * 0.5, y + r * 0.7, x + r * 0.7, y + r + 26);
  // 鼓身
  circle(g, x, y, r, shade(THEME.red, dim), THEME.outline, 6);
  circle(g, x, y, r * 0.72, shade(face, dim), THEME.outline, 5);
  circle(g, x, y, r * 0.22, shade(THEME.redDeep, dim), THEME.outline, 4);
  if (mark !== 'drum') return;
  // 鼓响着：一波一波的波纹推出去（这就是"鼓面一圈圈波纹"）
  for (let i = 0; i < 3; i += 1) {
    const phase = (ripple + i / 3) % 1;
    g.lineStyle(6 - i, THEME.paper, (1 - phase) * 0.75);
    g.strokeCircle(x, y, r + 18 + phase * 210);
  }
}

/** 我们的战鼓 —— 出击按钮就画在关卡给的位置上（画面不见字，全靠形状） */
function drawActionDrum(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  hot: boolean,
  pressed: number,
): void {
  groundShadow(g, x, y + r * 0.72, r * 1.9, 30, 0.2);
  circle(g, x, y, r, THEME.red, THEME.outline, 8);
  circle(g, x, y, r * 0.82, THEME.paper, THEME.outline, 6);
  circle(g, x, y, r * 0.62, shade(THEME.gold, hot ? 1.06 : 0.92), THEME.outline, 6);
  circle(g, x, y, r * 0.2, THEME.redDeep, THEME.outline, 5);
  // 鼓钉：一圈小鼓钉，橡皮图章一样的可爱
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    circle(g, x + Math.cos(angle) * r * 0.88, y + Math.sin(angle) * r * 0.88, 6, THEME.goldDeep, null, 0, 0.9);
  }
  if (pressed > 0) {
    // 刚点过：鼓面凹一下（力量感）
    g.lineStyle(8, THEME.paper, 0.5 * pressed);
    g.strokeCircle(x, y, r * 0.66);
  }
}

/** 整屏战场 */
export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  state: StillnessStageState,
  beats: StillnessBeat[],
  action: { x: number; y: number; radius: number },
): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  const correctIndex = beats.findIndex((beat) => beat.correct);

  // 黄昏的天空
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, TOP, W, RIDGE_Y - TOP + 40);
  g.fillStyle(shade(THEME.sand, 1.02), 0.5);
  g.fillRect(0, RIDGE_Y - 200, W, 240);
  circle(g, 588, 316, 96, THEME.gold, null, 0, 0.16);
  circle(g, 588, 316, 66, 0xfff1cd, THEME.gold, 6);
  // 远处的山
  g.fillStyle(shade(THEME.skyDeep, 0.94), 1);
  g.fillTriangle(-60, RIDGE_Y, 180, RIDGE_Y - 150, 420, RIDGE_Y);
  g.fillTriangle(330, RIDGE_Y, 566, RIDGE_Y - 122, 810, RIDGE_Y);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(-60, RIDGE_Y, 180, RIDGE_Y - 150, 420, RIDGE_Y);
  g.strokeTriangle(330, RIDGE_Y, 566, RIDGE_Y - 122, 810, RIDGE_Y);

  // 大地
  g.fillStyle(EARTH, 1);
  g.fillRect(0, RIDGE_Y, W, H - RIDGE_Y);
  g.fillStyle(shade(EARTH, 0.92), 1);
  g.fillRect(0, 1180, W, H - 1180);
  g.fillStyle(shade(EARTH, 1.08), 0.5);
  g.fillEllipse(375, 1040, 520, 120);
  for (const [tx, ty] of [[40, 1300], [190, 1258], [560, 1290], [700, 1250], [660, 1130]] as const) {
    g.fillStyle(shade(THEME.leaf, 0.8), 1);
    g.fillTriangle(tx - 14, ty, tx, ty - 30, tx + 14, ty);
    g.fillTriangle(tx - 26, ty + 6, tx - 10, ty - 18, tx + 2, ty + 6);
  }

  // 敌军（对面，左边）：三通鼓一通比一通没劲
  const tired = tiredness(state, correctIndex);
  ENEMY_XS.forEach((x, i) => {
    drawSoldier(g, x, ENEMY_FEET_Y, ENEMY_INK, {
      droop: tired,
      lean: -2 + tired * 6,
      scale: i % 2 === 0 ? 0.98 : 0.9,
    });
  });

  // 三面鼓：轮到哪一面就响哪一面，敲完的暗下去
  DRUM.xs.forEach((x, i) => {
    const mark = state.marks[i] ?? 'rest';
    const ripple = mark === 'drum' ? state.pulse : 0;
    drawDrum(g, x, DRUM.y, DRUM.r, mark, ripple);
  });

  // 我军（这边，右边）：按着不动；白鼓之后晃一下又站稳
  const wobble = ourWobble(state);
  OUR_XS.forEach((x, i) => {
    const step = state.done ? -26 : 0;
    drawSoldier(g, x + step - wobble * (i === 0 ? 22 : 10), OUR_FEET_Y, OUR_INK, {
      lean: wobble * 12 + (state.done ? -4 : 0),
      scale: i % 2 === 0 ? 1 : 0.92,
    });
  });
  if (wobble > 0) {
    // 晃的那一下扬起一点土（"还有劲"）
    for (let i = 0; i < 3; i += 1) {
      circle(g, 470 - i * 34, OUR_FEET_Y + 8, 9 + i * 3, shade(EARTH, 1.2), null, 0, 0.35 * wobble);
    }
  }

  // 出击的鼓（模板会给它套一圈金光）
  drawActionDrum(g, action.x, action.y, action.radius, state.canStrike, wobble);
}

/** 对面还有多少劲：0 = 精神得很，1 = 三而竭 */
function tiredness(state: StillnessStageState, correctIndex: number): number {
  if (state.done) return 1;
  if (state.roundOver) return 0.5;
  if (state.phase === 'done') return 0.5;
  if (state.index < correctIndex) return 0.12 + state.index * 0.16;
  if (state.phase === 'drum') return 0.4 + state.pulse * 0.6;
  return 1;
}

/** 白鼓之后的"晃一下又站稳"：1200ms 内衰减到 0 */
function ourWobble(state: StillnessStageState): number {
  if (state.lastStrike !== 'early') return 0;
  const t = state.sinceStrikeMs;
  if (t > 1200) return 0;
  const decay = 1 - t / 1200;
  return Math.abs(Math.sin(t / 110)) * decay;
}

/** 打赢之后：我军往前一步站定，对面没劲了 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(560, 880, 320);
  g.lineStyle(8, THEME.gold, 0.5);
  g.strokeCircle(560, 880, 250);
}

/** 分幕插图：① 齐军在对面擂鼓 ② 曹刿按住鲁庄公的手 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 1.02), 0.6);
  g.fillRoundedRect(x - 20, y + h * 0.6, w + 40, h * 0.45, 30);
  g.fillStyle(EARTH, 1);
  g.fillRoundedRect(x - 20, y + h * 0.76, w + 40, h * 0.3, 30);

  const feetY = y + h * 0.78;
  if (index === 0) {
    // 对面的鼓一面接一面地响
    for (const dx of [0.2, 0.4] as const) drawDrum(g, x + w * dx, feetY - 60, 44, 'drum', 0.3);
    drawSoldier(g, x + w * 0.14, feetY, ENEMY_INK, { scale: 1.05 });
    drawSoldier(g, x + w * 0.32, feetY, ENEMY_INK, { scale: 0.95 });
    // 这一边：鲁庄公要冲
    drawSoldier(g, x + w * 0.68, feetY, OUR_INK, { lean: 14, scale: 1.15 });
    drawSoldier(g, x + w * 0.86, feetY, OUR_INK, { scale: 1 });
  } else {
    // 曹刿按住鲁庄公的手
    drawSoldier(g, x + w * 0.42, feetY, OUR_INK, { lean: 10, scale: 1.15 });
    drawSoldier(g, x + w * 0.62, feetY, shade(OUR_INK, 0.88), { lean: -6, scale: 1.1 });
    g.lineStyle(12, 0xf8d9b4, 1);
    g.lineBetween(x + w * 0.5, feetY - 92, x + w * 0.6, feetY - 62);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeCircle(x + w * 0.5, feetY - 96, 16);
  }
}
