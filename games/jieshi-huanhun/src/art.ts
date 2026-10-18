import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { BannerStageMetrics } from '@chags/templates';
import type { BorrowBannerLevel, BorrowFlag } from '@chags/templates/schemas';
import {
  FALLEN, FLAG_H, FLAG_W, GROUND_Y, POLE, POLE_BASE_Y, POLE_TOP_Y, POLE_WIDTH, RAISED_Y,
  rallySpot,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;
const SKIN = 0xf6d3ae;

/** 黄昏的天：暖色从上到下压下来，几颗早出的星 */
function drawSky(g: Phaser.GameObjects.Graphics, elapsedMs: number): void {
  g.fillStyle(shade(THEME.sky, 0.94), 1);
  g.fillRect(0, 150, W, H - 150);
  g.fillStyle(shade(THEME.gold, 0.9), 0.32);
  g.fillRect(0, 520, W, 320);
  g.fillStyle(shade(THEME.gold, 1.04), 0.4);
  g.fillEllipse(W / 2, 940, 900, 300);
  circle(g, 604, 300, 62, THEME.paper, null, 0, 0.85);
  circle(g, 580, 282, 14, shade(THEME.gold, 0.9), null, 0, 0.35);
  // 星星一闪一闪（很慢，够安静）
  for (const [sx, sy, phase] of [[92, 236, 0], [268, 196, 0.6], [486, 252, 0.3]] as const) {
    const twinkle = 0.35 + 0.35 * Math.sin(elapsedMs / 900 + phase * 6.28);
    circle(g, sx, sy, 7, THEME.paper, null, 0, twinkle);
  }
}

/** 空地：一条地平线、一片土地 */
function drawGround(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(shade(THEME.teal, 0.9), 1);
  g.fillRect(0, GROUND_Y - 120, W, 160);
  g.fillStyle(shade(THEME.sand, 0.96), 1);
  g.fillRect(0, GROUND_Y - 20, W, H - GROUND_Y + 20);
  g.lineStyle(8, shade(THEME.sand, 0.78), 0.8);
  g.lineBetween(-20, GROUND_Y + 96, W + 20, GROUND_Y - 10);
  g.fillStyle(shade(THEME.sand, 0.86), 0.6);
  g.fillEllipse(300, GROUND_Y + 40, 420, 70);
}

/** 旗杆：一根木杆 + 一个石头底座 */
function drawPole(g: Phaser.GameObjects.Graphics): void {
  groundShadow(g, POLE.x, POLE_BASE_Y + 10, 240, 46, 0.2);
  roundRect(g, POLE.x - POLE_WIDTH / 2, POLE_TOP_Y, POLE_WIDTH, POLE_BASE_Y - POLE_TOP_Y, 10, THEME.wood, THEME.outline, 6);
  roundRect(g, POLE.x - 70, POLE_BASE_Y - 34, 140, 54, 20, shade(THEME.stone, 1.02), THEME.outline, 6);
  circle(g, POLE.x, POLE_TOP_Y - 12, 20, THEME.gold, THEME.outline, 5);
  // 杆上系着的一小段绳（旗就挂在这儿）
  g.lineStyle(7, 0x8a6a4d, 1);
  g.lineBetween(POLE.x + POLE_WIDTH / 2 - 4, RAISED_Y + 10, POLE.x + 56, RAISED_Y - 26);
}

/** 一面旗：短杆 + 旗面，旗面上点出 rally 个数（数得出来才叫"写在旗上"） */
function drawFlag(
  g: Phaser.GameObjects.Graphics,
  flag: BorrowFlag,
  x: number,
  y: number,
  scale: number,
  raised: boolean,
): void {
  const w = FLAG_W * scale;
  const h = FLAG_H * scale;
  const poleColor = raised ? THEME.goldDeep : THEME.woodDeep;
  roundRect(g, x - 9 * scale, y - 168 * scale, 18 * scale, 176 * scale, 8 * scale, poleColor, THEME.outline, 5 * scale);
  // 旗面：往右飘
  g.fillStyle(raised ? THEME.red : shade(THEME.teal, 1.02), 1);
  g.fillTriangle(x + 8 * scale, y - 164 * scale, x + 8 * scale, y - 164 * scale + h, x + w, y - 164 * scale + h * 0.46);
  g.lineStyle(5 * scale, THEME.outline, 1);
  g.strokeTriangle(x + 8 * scale, y - 164 * scale, x + 8 * scale, y - 164 * scale + h, x + w, y - 164 * scale + h * 0.46);
  // rally 的点：几个点就能召回几个人
  const perRow = 2;
  const rows = Math.ceil(flag.rally / perRow);
  for (let i = 0; i < flag.rally; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const dotX = x + 8 * scale + w * 0.28 + col * 30 * scale;
    const dotY = y - 164 * scale + h * 0.3 + row * 30 * scale - (rows - 1) * 15 * scale;
    circle(g, dotX, dotY, 10 * scale, THEME.paper, THEME.outline, 4 * scale);
  }
}

/**
 * 一个人：away（还没回来）是背对着画面的样子，back（归队了）转过身来笑着。
 * 画面里没有任何武器、也没有倒在地上的人 —— 只有一群走散的人。
 */
function drawPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  back: boolean,
  walk: number,
): void {
  const s = 0.62 + 0.38 * scale;
  const bob = Math.sin(walk * Math.PI) * 8 * s;
  groundShadow(g, x, y + 4 * s, 120 * s, 26 * s, 0.16);
  const step = Math.abs(Math.sin(walk * Math.PI * 2)) * 16 * s;
  for (const dir of [-1, 1] as const) {
    roundRect(g, x + dir * step - 9 * s, y - 56 * s + bob, 18 * s, 58 * s, 8 * s, THEME.woodDeep, THEME.outline, 5 * s);
  }
  roundRect(g, x - 32 * s, y - 138 * s + bob, 64 * s, 88 * s, 26 * s, back ? shade(THEME.teal, 0.96) : shade(THEME.stone, 0.98), THEME.outline, 6 * s);
  if (back) {
    g.fillStyle(THEME.card, 1);
    g.fillTriangle(x - 16 * s, y - 136 * s + bob, x + 16 * s, y - 136 * s + bob, x, y - 104 * s + bob);
    g.lineStyle(4 * s, THEME.outline, 1);
    g.strokeTriangle(x - 16 * s, y - 136 * s + bob, x + 16 * s, y - 136 * s + bob, x, y - 104 * s + bob);
  }
  // 手臂
  g.lineStyle(11 * s, back ? shade(THEME.teal, 0.88) : shade(THEME.stone, 0.9), 1);
  g.lineBetween(x + 20 * s, y - 120 * s + bob, x + 44 * s, y - 96 * s + bob - step);
  g.lineBetween(x - 20 * s, y - 120 * s + bob, x - 44 * s, y - 96 * s + bob + step);
  // 头：背对着的时候只画后脑勺
  circle(g, x, y - 168 * s + bob, 30 * s, SKIN, THEME.outline, 6 * s);
  g.fillStyle(THEME.ink, 1);
  if (back) {
    g.fillEllipse(x, y - 182 * s + bob, 64 * s, 28 * s);
    for (const dir of [-1, 1] as const) {
      g.fillEllipse(x + dir * 11 * s, y - 168 * s + bob, 9 * s, 12 * s);
    }
    g.lineStyle(5 * s, THEME.outline, 0.9);
    g.beginPath();
    g.moveTo(x - 14 * s, y - 152 * s + bob);
    g.lineTo(x, y - 145 * s + bob);
    g.lineTo(x + 14 * s, y - 152 * s + bob);
    g.strokePath();
  } else {
    g.fillEllipse(x, y - 176 * s + bob, 62 * s, 48 * s);
  }
}

/** 顶上一排点：召回了几个人 / 要几个（孩子的进度是数得出来的） */
function drawRallyPips(g: Phaser.GameObjects.Graphics, stage: BannerStageMetrics): void {
  const gap = 54;
  const y = 196;
  const total = stage.needed;
  const startX = W / 2 - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i += 1) {
    const x = startX + i * gap;
    const lit = i < Math.min(stage.ralliedCount, total);
    circle(g, x, y, 19, lit ? THEME.gold : shade(THEME.card, 0.92), THEME.outline, 5);
    if (lit) {
      g.fillStyle(THEME.paper, 1);
      g.fillCircle(x, y, 7);
    }
  }
}

/** 一面旗此刻在哪儿：竖着的挂到杆上，还在地上的插在原地，拖着的那面临时跟着手指 */
function flagPosition(stage: BannerStageMetrics, flag: BorrowFlag): { x: number; y: number } {
  if (stage.dragging === flag.id && stage.dragAt) return { ...stage.dragAt };
  const raisedIndex = stage.raised.indexOf(flag.id);
  if (raisedIndex >= 0) return { x: POLE.x + 12, y: RAISED_Y + 140 + raisedIndex * 96 };
  return { x: flag.x, y: flag.y };
}

/** 散人此刻在哪儿：还没回来的在原地，回来的往旗杆下走（最新那批按 sinceRaiseMs 走） */
function personPosition(
  stage: BannerStageMetrics,
  level: BorrowBannerLevel,
  personId: string,
  ralliedIndex: number,
): { x: number; y: number; walking: number } {
  const home = level.scattered.find((person) => person.id === personId);
  if (home === undefined) return { x: POLE.x, y: GROUND_Y, walking: 0 };
  if (ralliedIndex < 0) return { x: home.x, y: home.y, walking: 0 };
  const target = rallySpot(ralliedIndex);
  const isNewcomer = ralliedIndex >= stage.ralliedCount - stage.lastRallied;
  if (!isNewcomer) return { x: target.x, y: target.y, walking: 0 };
  const raw = stage.sinceRaiseMs / 900;
  const t = Math.max(0, Math.min(1, raw));
  const ease = t * t * (3 - 2 * t);
  return {
    x: home.x + (target.x - home.x) * ease,
    y: home.y + (target.y - home.y) * ease,
    walking: t < 1 ? t : 0,
  };
}

/** 整屏：黄昏、旗杆、地上的三面旗、倒下的旧旗、散掉的人（每帧重画） */
export function drawBanner(
  g: Phaser.GameObjects.Graphics,
  stage: BannerStageMetrics,
  level: BorrowBannerLevel,
): void {
  drawSky(g, stage.elapsedMs);
  drawGround(g);
  drawPole(g);

  // 倒下的旧旗：一直躺在泥里（画面上的"旧旗"就是这一面）
  g.lineStyle(14, THEME.woodDeep, 1);
  g.lineBetween(FALLEN.x - 96, FALLEN.y + 8, FALLEN.x + 96, FALLEN.y - 12);
  g.fillStyle(shade(THEME.red, 0.82), 1);
  g.fillTriangle(FALLEN.x - 40, FALLEN.y - 6, FALLEN.x + 96, FALLEN.y - 12, FALLEN.x + 30, FALLEN.y + 46);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(FALLEN.x - 40, FALLEN.y - 6, FALLEN.x + 96, FALLEN.y - 12, FALLEN.x + 30, FALLEN.y + 46);
  g.lineStyle(6, shade(THEME.red, 0.7), 0.8);
  g.lineBetween(FALLEN.x - 10, FALLEN.y + 6, FALLEN.x + 26, FALLEN.y + 18);

  // 散掉的人：还没回来的背对着在远处，回来的站在杆下
  level.scattered.forEach((person) => {
    const ralliedIndex = stage.rallied.indexOf(person.id);
    const at = personPosition(stage, level, person.id, ralliedIndex);
    drawPerson(g, at.x, at.y, 1, ralliedIndex >= 0, at.walking);
  });

  // 地上的旗与杆上的旗
  level.flags.forEach((flag) => {
    const at = flagPosition(stage, flag);
    if (stage.raised.includes(flag.id)) {
      drawFlag(g, flag, at.x, at.y, 0.72, true);
      return;
    }
    if (!stage.available.includes(flag.id)) return;
    groundShadow(g, at.x, at.y + 6, 96, 24, 0.16);
    drawFlag(g, flag, at.x, at.y, 1, false);
  });

  drawRallyPips(g, stage);

  // 拖着的那面旗：手指下面加一圈光，说明"抓住它了"
  if (stage.dragging !== null && stage.dragAt !== null) {
    g.lineStyle(8, THEME.gold, 0.75);
    g.strokeCircle(stage.dragAt.x, stage.dragAt.y - 60, 96);
  }

  if (stage.done) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse(POLE.x, GROUND_Y - 200, 940, 700);
  }
}

/** 收尾：旧旗在杆上飘着，散掉的人都在杆下 —— 是名号把人叫回来的 */
export function drawBannerFinale(
  g: Phaser.GameObjects.Graphics,
  stage: BannerStageMetrics,
  level: BorrowBannerLevel,
): void {
  g.fillStyle(THEME.gold, 0.18);
  g.fillEllipse(POLE.x, GROUND_Y - 260, 1000, 780);
  g.lineStyle(12, THEME.gold, 0.55);
  g.strokeCircle(POLE.x, RAISED_Y + 120, 340);
  level.scattered.forEach((_person, index) => {
    const at = rallySpot(index);
    drawPerson(g, at.x, at.y, 1, true, 0);
  });
  level.flags.forEach((flag) => {
    const raisedIndex = stage.raised.indexOf(flag.id);
    if (raisedIndex < 0) return;
    drawFlag(g, flag, POLE.x + 12, RAISED_Y + 140 + raisedIndex * 96, 0.72, true);
  });
}

/** 分幕插图：① 队伍散了，只剩一面倒在泥里的旧旗 ② 旧旗一竖，脚步从四面八方回来 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(THEME.sky, 0.94), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.gold, 0.9), 0.34);
  g.fillRect(x - 20, y + h * 0.34, w + 40, h * 0.3);
  const groundY = y + h * 0.78;
  g.fillStyle(shade(THEME.sand, 0.96), 1);
  g.fillRoundedRect(x - 20, groundY - 40, w + 40, h * 0.34, 26);
  const poleX = x + w * 0.5;

  if (index === 0) {
    // ① 空地上一面倒下的旧旗，几个人影往两边走散
    g.lineStyle(12, THEME.woodDeep, 1);
    g.lineBetween(poleX - 90, groundY + 16, poleX + 90, groundY - 6);
    g.fillStyle(shade(THEME.red, 0.82), 1);
    g.fillTriangle(poleX - 30, groundY + 4, poleX + 92, groundY - 6, poleX + 34, groundY + 48);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(poleX - 30, groundY + 4, poleX + 92, groundY - 6, poleX + 34, groundY + 48);
    drawPerson(g, x + w * 0.2, groundY + 6, 0.8, false, 0.4);
    drawPerson(g, x + w * 0.82, groundY - 4, 0.7, false, 0.7);
    return;
  }
  // ② 旧旗在杆上飘，四面八方的脚印朝中间来
  circle(g, poleX, groundY - 150, 16, THEME.gold, THEME.outline, 5);
  g.lineStyle(12, THEME.wood, 1);
  g.lineBetween(poleX, groundY - 130, poleX, groundY + 26);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(poleX + 8, groundY - 128, poleX + 8, groundY - 40, poleX + 108, groundY - 84);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(poleX + 8, groundY - 128, poleX + 8, groundY - 40, poleX + 108, groundY - 84);
  for (const dir of [-1, 1] as const) {
    drawPerson(g, poleX + dir * w * 0.3, groundY + 2, 0.8, true, 0.2);
    g.lineStyle(7, THEME.leaf, 0.85);
    for (let i = 0; i < 3; i += 1) {
      const px = poleX + dir * (w * 0.42 - i * 46);
      g.lineBetween(px, groundY + 30 + i * 12, px - dir * 22, groundY + 30 + i * 12);
    }
  }
}
