import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { FAVOR_TIMING } from '@chags/templates/lure.logic';
import type { LureFavorStage } from '@chags/templates';
import type { LureFavorLevel, LureGift } from '@chags/templates/schemas';
import {
  DAIS_BOTTOM, DAIS_TOP, FLOOR_TOP, GAZE_EYE_Y, GAZE_WIDTH, GIFT_RADIUS, KING, PILLAR_BOTTOM,
  PILLAR_TOP, PILLAR_XS, RUG, SKY_TOP, STEPS, TABLE_BOTTOM, TABLE_TOP, TABLE_W, WINDOW,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 殿内的配色：暖墙、木案、深红柱子 —— 三样东西摆在暖色里，一眼看得出都是好东西 */
const WALL = 0xf0dcb4;
const WALL_DEEP = 0xdcc294;
const BEAM_WOOD = 0x8a5a3b;
const PILLAR = 0x9c3f30;
const PILLAR_DEEP = 0x7a2f24;
const FLOOR = 0xd7c69e;
const FLOOR_LINE = 0xbfa97e;
const MAT = 0x5f8f86;
const MAT_DEEP = 0x47706a;
const RUG_RED = 0xa8452f;
const RUG_DEEP = 0x8a3524;
const TABLE_WOOD = 0xc98a4b;
const SKIN = 0xf8dcbb;
const ROBE = 0x4a4266;
const ROBE_DEEP = 0x383250;
const HORSE = 0xa9663a;
const HORSE_DEEP = 0x8a4f2c;
const SILK = 0xf6d9e6;
const SILK_DEEP = 0xe0b6cb;
const BLADE = 0xb9c4cc;
const BLADE_LIGHT = 0xe6eef2;

// ---------------- 小零件 ----------------

/** 一样东西底下那点"落地感"：它站在案上，不是飘着 */
function seat(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number): void {
  groundShadow(g, x, y, w, 22, 0.18);
}

/** 骏马：越国送来的好马（站着，鬃毛与尾巴都在） */
function drawHorse(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  const w = 118 * s;
  const h = 76 * s;
  seat(g, x, y + 44 * s, w * 1.02);
  // 四条腿
  g.lineStyle(11 * s, HORSE_DEEP, 1);
  for (const dx of [-0.34, -0.16, 0.18, 0.34]) {
    g.lineBetween(x + w * dx, y + 12 * s, x + w * dx, y + 44 * s);
  }
  // 身子
  g.fillStyle(HORSE, 1);
  g.fillEllipse(x, y, w, h);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeEllipse(x, y, w, h);
  // 脖子与头
  g.fillStyle(HORSE, 1);
  g.fillTriangle(x + w * 0.26, y - 6 * s, x + w * 0.5, y - 62 * s, x + w * 0.42, y + 12 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x + w * 0.26, y - 6 * s, x + w * 0.5, y - 62 * s, x + w * 0.42, y + 12 * s);
  g.fillStyle(HORSE, 1);
  g.fillEllipse(x + w * 0.54, y - 64 * s, 56 * s, 34 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeEllipse(x + w * 0.54, y - 64 * s, 56 * s, 34 * s);
  // 耳朵
  g.fillStyle(HORSE_DEEP, 1);
  g.fillTriangle(x + w * 0.46, y - 74 * s, x + w * 0.52, y - 92 * s, x + w * 0.58, y - 74 * s);
  // 鬃毛
  g.lineStyle(9 * s, HORSE_DEEP, 1);
  g.lineBetween(x + w * 0.44, y - 58 * s, x + w * 0.2, y - 16 * s);
  // 尾巴
  g.lineStyle(10 * s, HORSE_DEEP, 1);
  g.lineBetween(x - w * 0.48, y - 12 * s, x - w * 0.62, y + 26 * s);
  // 眼睛
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + w * 0.6, y - 68 * s, 4.5 * s);
}

/** 丝绸：越国送来的上等绸子（叠好的一匹，系着红丝带） */
function drawSilk(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  seat(g, x, y + 40 * s, 150 * s);
  roundRect(g, x - 78 * s, y - 12 * s, 156 * s, 52 * s, 16 * s, SILK_DEEP, THEME.outline, 5 * s);
  roundRect(g, x - 72 * s, y - 48 * s, 144 * s, 46 * s, 14 * s, SILK, THEME.outline, 5 * s);
  roundRect(g, x - 66 * s, y - 74 * s, 132 * s, 34 * s, 12 * s, shade(SILK, 1.04), THEME.outline, 5 * s);
  // 红丝带
  g.lineStyle(11 * s, THEME.red, 1);
  g.lineBetween(x - 76 * s, y - 6 * s, x + 76 * s, y - 6 * s);
  g.lineStyle(5 * s, THEME.redDeep, 1);
  g.lineBetween(x - 76 * s, y - 6 * s, x + 76 * s, y - 6 * s);
  // 那一层薄薄的光泽：绸子的"软"全在这一笔上
  g.fillStyle(0xffffff, 0.55);
  g.fillEllipse(x - 26 * s, y - 58 * s, 46 * s, 12 * s);
  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(x + 30 * s, y - 30 * s, 34 * s, 9 * s);
}

/** 宝剑：越国送来的名剑（横在案上，剑身亮） */
function drawSword(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  seat(g, x, y + 40 * s, 160 * s);
  // 剑身
  roundRect(g, x - 86 * s, y - 10 * s, 152 * s, 24 * s, 10 * s, BLADE, THEME.outline, 5 * s);
  g.fillStyle(BLADE_LIGHT, 1);
  g.fillRect(x - 78 * s, y - 5 * s, 132 * s, 7 * s);
  // 剑尖
  g.fillStyle(BLADE, 1);
  g.fillTriangle(x - 86 * s, y - 10 * s, x - 112 * s, y + 2 * s, x - 86 * s, y + 14 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x - 86 * s, y - 10 * s, x - 112 * s, y + 2 * s, x - 86 * s, y + 14 * s);
  // 护手与剑柄
  roundRect(g, x + 62 * s, y - 20 * s, 24 * s, 44 * s, 8 * s, THEME.gold, THEME.outline, 5 * s);
  roundRect(g, x + 84 * s, y - 12 * s, 46 * s, 28 * s, 13 * s, THEME.goldDeep, THEME.outline, 5 * s);
  g.lineStyle(5 * s, THEME.gold, 1);
  g.lineBetween(x + 92 * s, y - 12 * s, x + 92 * s, y + 16 * s);
}

/** 三样东西按 kind 分派 —— kind 是关卡数据说了算的 */
function drawGift(g: Phaser.GameObjects.Graphics, gift: LureGift): void {
  if (gift.kind === 'horse') drawHorse(g, gift.x, gift.y);
  else if (gift.kind === 'silk') drawSilk(g, gift.x, gift.y);
  else if (gift.kind === 'sword') drawSword(g, gift.x, gift.y);
  else drawSilk(g, gift.x, gift.y);
}

/** 一张案：三样东西各摆在一样的案上（x 就是关卡数据里那样东西的 x） */
function drawTable(g: Phaser.GameObjects.Graphics, x: number): void {
  groundShadow(g, x, TABLE_BOTTOM + 4, TABLE_W * 1.1, 26, 0.18);
  roundRect(g, x - TABLE_W / 2 + 16, TABLE_TOP + 18, 22, TABLE_BOTTOM - TABLE_TOP - 18, 8, shade(TABLE_WOOD, 0.8), THEME.outline, 5);
  roundRect(g, x + TABLE_W / 2 - 38, TABLE_TOP + 18, 22, TABLE_BOTTOM - TABLE_TOP - 18, 8, shade(TABLE_WOOD, 0.8), THEME.outline, 5);
  roundRect(g, x - TABLE_W / 2, TABLE_TOP, TABLE_W, 24, 10, TABLE_WOOD, THEME.outline, 6);
  g.lineStyle(4, shade(TABLE_WOOD, 1.16), 1);
  g.lineBetween(x - TABLE_W / 2 + 14, TABLE_TOP + 8, x + TABLE_W / 2 - 14, TABLE_TOP + 8);
}

/** 他的格窗：光从这儿斜进来（殿里亮的那一片就是它） */
function drawWindow(g: Phaser.GameObjects.Graphics): void {
  const { x, y, w, h } = WINDOW;
  g.fillStyle(0xfff4d2, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
  g.lineStyle(4, BEAM_WOOD, 0.8);
  for (let i = 1; i < 3; i += 1) {
    g.lineBetween(x - w / 2 + (w * i) / 3, y - h / 2, x - w / 2 + (w * i) / 3, y + h / 2);
  }
  for (let j = 1; j < 3; j += 1) {
    g.lineBetween(x - w / 2, y - h / 2 + (h * j) / 3, x + w / 2, y - h / 2 + (h * j) / 3);
  }
  g.lineStyle(9, BEAM_WOOD, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
}

/** 光柱：从窗口斜斜落到地上的一片暖光 */
function drawLightShaft(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xfff2c8, 0.16);
  g.beginPath();
  g.moveTo(WINDOW.x - WINDOW.w / 2 + 10, WINDOW.y + WINDOW.h / 2);
  g.lineTo(WINDOW.x + WINDOW.w / 2 - 10, WINDOW.y + WINDOW.h / 2);
  g.lineTo(WINDOW.x + 250, FLOOR_TOP + 240);
  g.lineTo(WINDOW.x - 150, FLOOR_TOP + 240);
  g.closePath();
  g.fillPath();
}

// ---------------- 景 ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: LureFavorLevel): void {
  // 墙
  g.fillStyle(WALL, 1);
  g.fillRect(0, SKY_TOP, W, FLOOR_TOP - SKY_TOP);
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(WALL_DEEP, 0.28);
    g.fillRect(0, SKY_TOP + 52 + i * 128, W, 8);
  }
  // 屋顶那道横梁与斗拱
  roundRect(g, -20, SKY_TOP, W + 40, 30, 0, BEAM_WOOD, THEME.outline, 6);
  for (let i = 0; i < 7; i += 1) {
    roundRect(g, 40 + i * 100, SKY_TOP + 26, 54, 26, 8, shade(BEAM_WOOD, 1.18), THEME.outline, 5);
  }
  drawWindow(g);

  // 地面（画在墙之后：墙只到 FLOOR_TOP 为止）
  g.fillStyle(FLOOR, 1);
  g.fillRect(0, FLOOR_TOP, W, H - FLOOR_TOP);
  g.lineStyle(4, FLOOR_LINE, 0.65);
  for (let y = FLOOR_TOP + 60; y < H; y += 92) g.lineBetween(0, y, W, y);
  for (let x = 40; x < W; x += 150) g.lineBetween(x, FLOOR_TOP, x - 90, H);
  drawLightShaft(g);

  // 殿下那张地毯
  roundRect(g, RUG.x - RUG.w / 2, RUG.y - RUG.h / 2, RUG.w, RUG.h, 46, RUG_RED, THEME.goldDeep, 8);
  roundRect(g, RUG.x - RUG.w / 2 + 26, RUG.y - RUG.h / 2 + 22, RUG.w - 52, RUG.h - 44, 34, RUG_DEEP, THEME.gold, 5);
  g.lineStyle(5, THEME.gold, 0.7);
  g.strokeCircle(RUG.x, RUG.y, 44);
  g.strokeCircle(RUG.x, RUG.y, 66);

  // 两根殿柱（立在地面上）
  for (const x of PILLAR_XS) {
    roundRect(g, x - 28, PILLAR_TOP, 56, PILLAR_BOTTOM - PILLAR_TOP, 16, PILLAR, THEME.outline, 7);
    roundRect(g, x - 34, PILLAR_TOP + 26, 68, 22, 8, THEME.goldDeep, THEME.outline, 5);
    roundRect(g, x - 34, PILLAR_BOTTOM - 48, 68, 22, 8, THEME.goldDeep, THEME.outline, 5);
    g.fillStyle(shade(PILLAR_DEEP, 0.9), 0.5);
    g.fillRect(x - 20, PILLAR_TOP + 60, 14, PILLAR_BOTTOM - PILLAR_TOP - 120);
  }

  // 他坐的那张席（台基 + 席子）
  groundShadow(g, KING.x, DAIS_BOTTOM + 8, 430, 44, 0.2);
  roundRect(g, KING.x - 192, DAIS_TOP, 384, DAIS_BOTTOM - DAIS_TOP, 22, shade(TABLE_WOOD, 0.9), THEME.outline, 7);
  roundRect(g, KING.x - 162, DAIS_TOP + 14, 324, DAIS_BOTTOM - DAIS_TOP - 44, 16, MAT, THEME.outline, 6);
  g.lineStyle(5, MAT_DEEP, 1);
  g.lineBetween(KING.x - 140, DAIS_TOP + 50, KING.x + 140, DAIS_TOP + 50);
  g.lineBetween(KING.x - 140, DAIS_TOP + 92, KING.x + 140, DAIS_TOP + 92);

  // 三张案：**位置来自关卡数据**，美术不许自己另定
  for (const gift of level.gifts) drawTable(g, gift.x);

  // 殿前那几级台阶
  for (const step of STEPS) {
    roundRect(g, (W - step.w) / 2, step.y, step.w, 52, 10, shade(FLOOR, 0.94), THEME.outline, 5);
  }
}

// ---------------- 他 ----------------

/**
 * 吴王夫差：坐在席上。
 * - `gaze` = 他此刻在看的那一样东西（看着别处 = null）：眼睛与头都朝它偏一点；
 * - `pleased` = 他这会儿是高兴的（收下了东西）。
 */
function drawKing(
  g: Phaser.GameObjects.Graphics,
  gaze: LureGift | null,
  pleased: boolean,
): void {
  const x = KING.x;
  const y = KING.y;
  const headY = y - 92;
  const dx = gaze === null ? 0 : Math.max(-1, Math.min(1, (gaze.x - x) / 260));
  groundShadow(g, x, y + 78, 230, 40, 0.2);
  // 铺在席上的下摆
  g.fillStyle(ROBE, 1);
  g.fillEllipse(x, y + 52, 216, 118);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y + 52, 216, 118);
  g.fillStyle(ROBE_DEEP, 1);
  g.fillEllipse(x, y + 74, 150, 62);
  // 上身
  roundRect(g, x - 52, y - 46, 104, 108, 34, ROBE, THEME.outline, 6);
  g.lineStyle(9, THEME.gold, 1);
  g.lineBetween(x - 46, y + 6, x + 46, y + 6);
  // 两条袖子搭在膝上
  roundRect(g, x - 104, y + 16, 66, 44, 20, ROBE_DEEP, THEME.outline, 6);
  roundRect(g, x + 38, y + 16, 66, 44, 20, ROBE_DEEP, THEME.outline, 6);
  // 头
  circle(g, x + dx * 10, headY, 38, SKIN, THEME.outline, 6);
  // 冕（头顶那块板与垂下的珠串）
  roundRect(g, x - 46 + dx * 10, headY - 52, 92, 16, 6, THEME.inkSoft, THEME.outline, 5);
  for (let i = 0; i < 5; i += 1) {
    circle(g, x - 34 + i * 17 + dx * 10, headY - 44, 5, THEME.gold, THEME.outline, 3);
  }
  // 胡子
  g.fillStyle(shade(THEME.inkSoft, 1.1), 1);
  g.fillTriangle(x - 20 + dx * 10, headY + 22, x + 20 + dx * 10, headY + 22, x + dx * 10, headY + 58);
  // 眼睛：往他看的那样东西那边偏
  const eyeY = headY - 6;
  const eyeX = x + dx * 10;
  if (pleased) {
    g.lineStyle(6, THEME.outline, 1);
    g.beginPath();
    g.arc(eyeX - 14, eyeY, 11, Math.PI * 1.15, Math.PI * 1.85, false);
    g.strokePath();
    g.beginPath();
    g.arc(eyeX + 14, eyeY, 11, Math.PI * 1.15, Math.PI * 1.85, false);
    g.strokePath();
  } else {
    g.fillStyle(THEME.outline, 1);
    g.fillCircle(eyeX - 14 + dx * 5, eyeY, 7);
    g.fillCircle(eyeX + 14 + dx * 5, eyeY, 7);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(eyeX - 16 + dx * 5, eyeY - 3, 2.6);
    g.fillCircle(eyeX + 12 + dx * 5, eyeY - 3, 2.6);
  }
  // 嘴
  g.lineStyle(5, shade(THEME.inkSoft, 1.15), 1);
  g.beginPath();
  if (pleased) g.arc(eyeX, headY + 18, 16, Math.PI * 0.15, Math.PI * 0.85, false);
  else g.lineBetween(eyeX - 12, headY + 26, eyeX + 12, headY + 26);
  g.strokePath();
  if (pleased) {
    g.fillStyle(THEME.red, 0.24);
    g.fillEllipse(eyeX - 30, headY + 8, 22, 12);
    g.fillEllipse(eyeX + 30, headY + 8, 22, 12);
  }
}

/** 他看过去的那道目光：一束淡淡的光从他眼睛落到那样东西上 */
function drawGaze(g: Phaser.GameObjects.Graphics, gift: LureGift, strength: number): void {
  const eyeY = GAZE_EYE_Y;
  const fromX = KING.x;
  const toY = gift.y - 16;
  g.fillStyle(THEME.gold, 0.09 + 0.05 * strength);
  g.fillTriangle(fromX - GAZE_WIDTH / 2, eyeY, fromX + GAZE_WIDTH / 2, eyeY, gift.x, toY);
  g.lineStyle(5, THEME.gold, 0.26 + 0.3 * strength);
  g.lineBetween(fromX, eyeY, gift.x, toY);
  // 被看着的那一样外面一团暖气 —— 停得越久，越亮
  g.fillStyle(THEME.gold, 0.07 + 0.06 * strength);
  g.fillCircle(gift.x, gift.y, GIFT_RADIUS + 30);
}

// ---------------- 每帧 ----------------

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: LureFavorStage,
  level: LureFavorLevel,
): void {
  const ratio = state.gazeTotalMs > 0 ? Math.min(1, Math.max(0, state.gazeLeftMs / state.gazeTotalMs)) : 0;
  // 目光先画：它在所有东西的下面（人、东西都压在它上面）
  if (state.gaze !== null && !state.done) drawGaze(g, state.gaze, ratio);

  const justLoved = state.lastLoved === true && state.sinceOfferMs <= FAVOR_TIMING.offerFlashMs;
  const wanted = level.gifts.find((gift) => gift.kind === level.target.wants);
  // 收下之后那样东西就到了他手里 —— 案上那一份不再画
  const takenId = state.done && wanted !== undefined ? wanted.id : null;

  for (const gift of level.gifts) {
    if (gift.id === takenId) continue;
    // 被看着的那一样有个极淡的高光；已经送过的那一份在案沿上留两个记号
    if (state.gaze?.id === gift.id && !state.done) {
      g.fillStyle(THEME.paper, 0.35);
      g.fillCircle(gift.x, gift.y, GIFT_RADIUS + 12);
    }
    drawGift(g, gift);
    if (state.offered.includes(gift.id)) {
      // 案沿上两个墨点：这一样已经递过了（还能再递，零惩罚）
      g.fillStyle(THEME.inkSoft, 0.55);
      g.fillCircle(gift.x - 14, TABLE_TOP + 12, 7);
      g.fillCircle(gift.x + 14, TABLE_TOP + 12, 7);
    }
  }

  drawKing(g, state.gaze, state.done || justLoved);
  // 他手里捧着那样东西（打动了他）
  if (state.done && wanted !== undefined) {
    drawSilk(g, KING.x, KING.y + 6, 0.72);
  }
}

/** 收尾：他捧着那样东西，殿上还留着另外两样 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: LureFavorStage,
  level: LureFavorLevel,
): void {
  const wanted = level.gifts.find((gift) => gift.kind === level.target.wants);
  g.fillStyle(THEME.gold, 0.14);
  g.fillEllipse(KING.x, KING.y + 20, 660, 440);
  g.lineStyle(10, THEME.gold, 0.45);
  g.strokeCircle(KING.x, KING.y, 210);
  drawKing(g, null, true);
  if (wanted !== undefined) drawSilk(g, KING.x, KING.y + 6, 0.72);
  void state;
}

// ---------------- 分幕插图 ----------------

/**
 * 分幕插图：① 三样东西摆在殿下，他的目光停在其中一样上
 * ② 他捧起那一样 —— 送对了
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(WALL, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(WALL_DEEP, 0.3);
  g.fillRect(x + 14, y + h * 0.3, w - 28, 7);
  g.fillRect(x + 14, y + h * 0.56, w - 28, 7);

  // 一扇小格窗
  const wx = x + w * 0.5;
  const wy = y + h * 0.2;
  g.fillStyle(0xfff4d2, 1);
  g.fillRoundedRect(wx - w * 0.13, wy - h * 0.08, w * 0.26, h * 0.16, 12);
  g.lineStyle(4, BEAM_WOOD, 0.8);
  g.lineBetween(wx, wy - h * 0.08, wx, wy + h * 0.08);
  g.lineBetween(wx - w * 0.13, wy, wx + w * 0.13, wy);
  g.lineStyle(7, BEAM_WOOD, 1);
  g.strokeRoundedRect(wx - w * 0.13, wy - h * 0.08, w * 0.26, h * 0.16, 12);

  // 殿下那张案（三样东西排在案上）
  const tableY = y + h * 0.78;
  g.fillStyle(TABLE_WOOD, 1);
  g.fillRoundedRect(x + w * 0.1, tableY, w * 0.8, 16, 8);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x + w * 0.1, tableY, w * 0.8, 16, 8);
  const rowY = tableY - 34;
  g.fillStyle(THEME.inkSoft, 0.16);
  g.fillEllipse(x + w * 0.24, tableY - 2, 96, 16);
  g.fillEllipse(x + w * 0.5, tableY - 2, 96, 16);
  g.fillEllipse(x + w * 0.76, tableY - 2, 96, 16);

  // 三样东西（骏马 / 丝绸 / 宝剑）—— 用简化的小图，一眼认得出
  g.fillStyle(HORSE, 1);
  g.fillEllipse(x + w * 0.24, rowY, 66, 40);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x + w * 0.24, rowY, 66, 40);
  g.fillTriangle(x + w * 0.24 + 22, rowY - 6, x + w * 0.24 + 44, rowY - 46, x + w * 0.24 + 32, rowY + 8);
  g.fillEllipse(x + w * 0.24 + 46, rowY - 48, 34, 22);
  g.fillStyle(SILK, 1);
  g.fillRoundedRect(x + w * 0.5 - 44, rowY - 30, 88, 40, 12);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x + w * 0.5 - 44, rowY - 30, 88, 40, 12);
  g.lineStyle(8, THEME.red, 1);
  g.lineBetween(x + w * 0.5 - 42, rowY - 8, x + w * 0.5 + 42, rowY - 8);
  g.fillStyle(BLADE, 1);
  g.fillRoundedRect(x + w * 0.76 - 46, rowY - 12, 78, 18, 8);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x + w * 0.76 - 46, rowY - 12, 78, 18, 8);
  g.fillStyle(THEME.gold, 1);
  g.fillRoundedRect(x + w * 0.76 + 32, rowY - 16, 18, 26, 6);

  // 他：坐在上面看（第一幕看着丝绸，第二幕捧着它）
  const kx = x + w * 0.5;
  const ky = y + h * 0.42;
  g.fillStyle(ROBE, 1);
  g.fillEllipse(kx, ky + 34, 150, 78);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(kx, ky + 34, 150, 78);
  roundRect(g, kx - 36, ky - 34, 72, 74, 24, ROBE, THEME.outline, 5);
  circle(g, kx, ky - 52, 26, SKIN, THEME.outline, 5);
  roundRect(g, kx - 32, ky - 80, 64, 12, 5, THEME.inkSoft, THEME.outline, 4);

  if (index === 0) {
    // 目光落在那匹丝绸上 —— 这一计的全部线索
    const silkX = x + w * 0.5;
    g.fillStyle(THEME.gold, 0.12);
    g.fillTriangle(kx - 12, ky - 48, kx + 12, ky - 48, silkX, rowY - 30);
    g.lineStyle(5, THEME.gold, 0.5);
    g.lineBetween(kx, ky - 48, silkX, rowY - 30);
    g.fillStyle(THEME.gold, 0.16);
    g.fillCircle(silkX, rowY - 12, 62);
  } else {
    // 捧在手里：案上只剩另外两样
    drawSilk(g, kx, ky + 10, 0.52);
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse(kx, ky + 20, 300, 200);
    g.lineStyle(8, THEME.gold, 0.5);
    g.strokeCircle(kx, ky + 10, 120);
  }
}
