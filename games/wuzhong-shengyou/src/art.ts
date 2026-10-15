import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { ShowStageState } from '@chags/templates';
import type { ShowLevel } from '@chags/templates/schemas';
import {
  ARROW_FROM, FAR_BANK, GUNWALE_Y, HULL, MAST, MIST_TOP, SHADOW_DOTS, SLOT_RADIUS,
  STRAW_H, SUSPICION, WATER_TOP,
} from './layout';

const STRAW = 0xe8cd84;
const MIST = 0xffffff;
const W = DESIGN.width;
const H = DESIGN.height;

// ---------------- 草人：船帮空位上立起来的"影子" ----------------

/**
 * 一个草人。strength = 1 是刚画上去的，越接近 0 越淡越小 ——
 * "影子会淡掉"这件事必须一眼看得见，否则孩子不知道为什么要回来补。
 */
function drawStrawMan(g: Phaser.GameObjects.Graphics, x: number, y: number, strength: number): void {
  const s = 0.78 + 0.22 * Math.max(0, Math.min(1, strength));
  const a = 0.16 + 0.84 * Math.max(0, Math.min(1, strength));
  const hh = STRAW_H * s;
  const base = y + SLOT_RADIUS * 0.42;
  const bodyTop = base - hh * 0.66;
  const bodyH = base - bodyTop;

  groundShadow(g, x, base, 104 * s, 26 * s, 0.14 * a);
  // 身子：一捆草
  roundRect(g, x - hh * 0.22, bodyTop, hh * 0.44, bodyH, hh * 0.18, STRAW, THEME.outline, 6, a);
  // 腰间的两道草绳
  g.lineStyle(7, THEME.wood, a);
  g.lineBetween(x - hh * 0.22, bodyTop + bodyH * 0.34, x + hh * 0.22, bodyTop + bodyH * 0.34);
  g.lineBetween(x - hh * 0.22, bodyTop + bodyH * 0.74, x + hh * 0.22, bodyTop + bodyH * 0.74);
  // 两条平举的手臂（也是草把）
  roundRect(g, x - hh * 0.42, bodyTop + bodyH * 0.12, hh * 0.84, hh * 0.11, hh * 0.05, STRAW, THEME.outline, 5, a);
  // 头
  circle(g, x, bodyTop - hh * 0.13, hh * 0.16, STRAW, THEME.outline, 6, a);
  // 斗笠
  g.fillStyle(THEME.wood, a);
  g.fillTriangle(x - hh * 0.21, bodyTop - hh * 0.21, x + hh * 0.21, bodyTop - hh * 0.21, x, bodyTop - hh * 0.42);
  g.lineStyle(5, THEME.outline, a);
  g.strokeTriangle(x - hh * 0.21, bodyTop - hh * 0.21, x + hh * 0.21, bodyTop - hh * 0.21, x, bodyTop - hh * 0.42);
}

/** 扎在草人身上的箭：只扎草人，不扎人（儿童化的那一半就在这一笔里） */
function drawStuckArrows(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  count: number,
  strength: number,
): void {
  const a = 0.2 + 0.8 * Math.max(0, Math.min(1, strength));
  for (let i = 0; i < count; i += 1) {
    const ax = x - 34 + i * 32;
    const ay = y - 84 - (i % 2) * 30;
    g.lineStyle(6, THEME.inkSoft, a);
    g.lineBetween(ax - 30, ay - 26, ax + 6, ay + 4);
    g.fillStyle(THEME.red, a);
    g.fillTriangle(ax - 30, ay - 26, ax - 40, ay - 34, ax - 34, ay - 14);
    g.fillStyle(THEME.stone, a);
    g.fillTriangle(ax + 6, ay + 4, ax - 2, ay - 4, ax - 2, ay + 10);
  }
}

/** 雾里飞过来的箭：从画面外横着飞过船帮 */
function drawFlyingArrows(g: Phaser.GameObjects.Graphics, elapsedMs: number): void {
  for (let i = 0; i < 3; i += 1) {
    const phase = ((elapsedMs / 1200 + i * 0.34) % 1 + 1) % 1;
    const x = ARROW_FROM.x + phase * 900;
    const y = ARROW_FROM.y + i * 52 - phase * 26;
    g.lineStyle(5, THEME.inkSoft, 0.9);
    g.lineBetween(x - 46, y - 12, x + 10, y + 4);
    g.fillStyle(THEME.red, 0.95);
    g.fillTriangle(x - 46, y - 12, x - 62, y - 18, x - 52, y + 2);
    g.fillStyle(THEME.stone, 1);
    g.fillTriangle(x + 10, y + 4, x, y - 4, x, y + 12);
  }
}

// ---------------- 对面的疑心 ----------------

/**
 * 疑心条 + 四个小灯。
 * **小灯比疑心条更重要**：它说的是"同时要立住几个影子"，
 * 孩子看的是灯，不是数字。
 */
function drawSuspicion(
  g: Phaser.GameObjects.Graphics,
  state: ShowStageState,
  level: ShowLevel,
): void {
  const { x, y, w, h } = SUSPICION;
  roundRect(g, x, y, w, h, h / 2, THEME.card, THEME.outline, 5);
  const ratio = Math.max(0, Math.min(1, state.ratio));
  const fill = ratio * (w - 14);
  if (fill > 6) {
    roundRect(g, x + 7, y + 7, fill, h - 14, (h - 14) / 2, state.rising ? THEME.red : THEME.gold, null, 0);
  }
  // 一只眼睛：疑心越大，瞳孔睁得越圆
  const eyeX = x + 34;
  const eyeY = y + h / 2;
  g.fillStyle(THEME.paper, 1);
  g.fillEllipse(eyeX, eyeY, 46, 30);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(eyeX, eyeY, 46, 30);
  g.fillStyle(THEME.ink, 1);
  g.fillCircle(eyeX, eyeY, 4 + ratio * 9);
  if (ratio <= 0) {
    // 一点都没画的时候：眼睛是闭着的（对面什么都没看见）
    g.lineStyle(5, THEME.outline, 1);
    g.lineBetween(eyeX - 20, eyeY, eyeX + 20, eyeY);
  }

  // 四个小灯：立住几个亮几个 —— 亮满 needed 个，疑心才涨
  const alive = state.alive.length;
  for (let i = 0; i < level.needed; i += 1) {
    const lit = i < Math.min(alive, level.needed);
    const dotX = SHADOW_DOTS.x + i * SHADOW_DOTS.gap;
    circle(g, dotX, SHADOW_DOTS.y, SHADOW_DOTS.r, lit ? THEME.gold : shade(THEME.card, 0.92), THEME.outline, 5);
    if (lit) {
      g.fillStyle(THEME.paper, 1);
      g.fillCircle(dotX, SHADOW_DOTS.y, SHADOW_DOTS.r * 0.34);
    }
  }
}

// ---------------- 景 ----------------

/** 雾带：慢慢往右飘（世界层画一次是静的，画面层再飘） */
function drawMistBands(g: Phaser.GameObjects.Graphics, drift: number, alphaScale = 1): void {
  for (let i = 0; i < 3; i += 1) {
    const y = MIST_TOP + 30 + i * 300;
    const dir = i % 2 === 0 ? 1 : -1;
    wavyBand(
      g,
      -260 + drift * dir,
      y,
      W + 520,
      200,
      MIST,
      (0.2 - i * 0.04) * alphaScale,
      30,
      2.2,
    );
  }
}

/** 这条船：船身、船帮、桅杆与帆 */
function drawBoat(g: Phaser.GameObjects.Graphics, faint = false): void {
  const a = faint ? 0.7 : 1;
  roundRect(g, HULL.left, HULL.top, HULL.right - HULL.left, HULL.bottom - HULL.top, 52, THEME.wood, THEME.outline, 7, a);
  // 一列船板
  g.lineStyle(5, shade(THEME.wood, 0.8), a);
  for (let y = HULL.top + 90; y < HULL.bottom - 40; y += 84) {
    g.lineBetween(HULL.left + 40, y, HULL.right - 40, y);
  }
  // 船帮：六个空位落在这条线上
  roundRect(g, HULL.left - 14, GUNWALE_Y - 30, HULL.right - HULL.left + 28, 60, 28, shade(THEME.wood, 0.9), THEME.outline, 6, a);
  // 桅杆与帆
  roundRect(g, MAST.x - 14, MAST.y, 28, MAST.h, 12, shade(THEME.wood, 0.86), THEME.outline, 6, a);
  g.fillStyle(THEME.paper, a);
  g.fillTriangle(MAST.x + 16, MAST.y + 40, MAST.x + 16, MAST.y + 330, MAST.x + 210, MAST.y + 185);
  g.lineStyle(6, THEME.outline, a);
  g.strokeTriangle(MAST.x + 16, MAST.y + 40, MAST.x + 16, MAST.y + 330, MAST.x + 210, MAST.y + 185);
}

/** 这个世界：江、雾、对岸的影子、船、船帮上的六个空位（画一次） */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: ShowLevel): void {
  // 标题条（0..150）留给 BaseScene 的 drawBackdrop：江与雾从它下面开始
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, MIST_TOP, W, H - MIST_TOP);
  g.fillStyle(THEME.water, 1);
  g.fillRect(0, WATER_TOP, W, H - WATER_TOP);
  wavyBand(g, -30, WATER_TOP + 40, W + 60, 140, THEME.waterDeep, 0.3, 16, 3);
  wavyBand(g, -30, WATER_TOP + 430, W + 60, 320, THEME.waterDeep, 0.26, 20, 2.4);

  // 对岸：放箭的那一边，雾里只剩一点轮廓
  g.fillStyle(shade(THEME.teal, 0.62), 0.34);
  g.fillEllipse(FAR_BANK.x - 60, FAR_BANK.y + 30, 460, 260);
  g.fillStyle(shade(THEME.teal, 0.5), 0.3);
  for (let i = 0; i < 3; i += 1) {
    const bx = FAR_BANK.x + i * 74 - 30;
    g.fillTriangle(bx - 40, FAR_BANK.y + 40, bx + 44, FAR_BANK.y + 40, bx, FAR_BANK.y - 74);
  }

  drawBoat(g);

  // 六个空位：浅浅的圈 —— "这里可以立一个"
  for (const slot of level.slots) {
    g.lineStyle(6, THEME.gold, 0.34);
    g.strokeCircle(slot.x, slot.y - SLOT_RADIUS * 0.1, SLOT_RADIUS - 8);
  }

  drawMistBands(g, 0);
}

/** 每帧：草人、箭、对面的疑心 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: ShowStageState,
  level: ShowLevel,
): void {
  for (const slot of level.slots) {
    const strength = state.strength[slot.id] ?? 0;
    if (strength <= 0) continue;
    drawStrawMan(g, slot.x, slot.y, strength);
    drawStuckArrows(g, slot.x, slot.y, 1 + Math.round(strength * 2), strength);
  }

  drawFlyingArrows(g, state.elapsedMs);
  drawSuspicion(g, state, level);

  if (state.done) {
    g.fillStyle(THEME.gold, 0.16);
    g.fillEllipse(W / 2, GUNWALE_Y - 40, 940, 560);
  }
}

/** 收尾：六个草人全立着、箭扎满，雾里那一边再也不敢小看这条船 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _state: ShowStageState,
  level: ShowLevel,
): void {
  g.fillStyle(THEME.gold, 0.18);
  g.fillEllipse(W / 2, GUNWALE_Y - 70, 960, 660);
  g.lineStyle(9, THEME.gold, 0.55);
  g.strokeCircle(W / 2, GUNWALE_Y - 130, 320);
  for (const slot of level.slots) {
    drawStrawMan(g, slot.x, slot.y, 1);
    drawStuckArrows(g, slot.x, slot.y, 3, 1);
  }
}

// ---------------- 分幕插图 ----------------

/** 插图里那条小船（比正片小一号，位置按插图自己的矩形算） */
function drawBeatBoat(
  g: Phaser.GameObjects.Graphics,
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  roundRect(g, left, top, right - left, bottom - top, 34, THEME.wood, THEME.outline, 6);
  g.lineStyle(5, shade(THEME.wood, 0.8), 1);
  for (let y = top + 40; y < bottom - 20; y += 44) g.lineBetween(left + 26, y, right - 26, y);
  roundRect(g, left - 10, top - 12, right - left + 20, 34, 16, shade(THEME.wood, 0.9), THEME.outline, 5);
  const mastX = (left + right) / 2;
  roundRect(g, mastX - 9, top - 220, 18, 220, 8, shade(THEME.wood, 0.86), THEME.outline, 5);
  g.fillStyle(THEME.paper, 1);
  g.fillTriangle(mastX + 10, top - 200, mastX + 10, top - 40, mastX + 140, top - 120);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(mastX + 10, top - 200, mastX + 10, top - 40, mastX + 140, top - 120);
}

/**
 * 分幕插图：① 雾里的空船 ② 草人立起来、箭像雨一样飞来（全扎在草人上）
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  const waterTop = y + h * 0.42;
  g.fillStyle(THEME.water, 1);
  g.fillRoundedRect(x - 20, waterTop, w + 40, h * 0.62, 26);
  wavyBand(g, x - 20, waterTop + 24, w + 40, 150, THEME.waterDeep, 0.34, 16, 3);

  // 对岸的影子（放箭的那一边）
  g.fillStyle(shade(THEME.teal, 0.62), 0.3);
  g.fillEllipse(x + w * 0.06, waterTop - h * 0.06, w * 0.62, h * 0.28);

  const left = x + w * 0.18;
  const right = x + w * 0.94;
  const top = waterTop + h * 0.04;
  const bottom = waterTop + h * 0.26;
  drawBeatBoat(g, left, right, top, bottom);
  const gunwale = top + 22;

  if (index === 0) {
    // ① 船上空空的：只有几个空位
    for (let i = 0; i < 5; i += 1) {
      const px = left + 30 + ((right - left - 60) * i) / 4;
      g.lineStyle(5, THEME.gold, 0.4);
      g.strokeCircle(px, gunwale + 26, 22);
    }
  } else {
    // ② 一排草人立在船帮上，箭全扎在草人身上
    for (let i = 0; i < 5; i += 1) {
      const px = left + 30 + ((right - left - 60) * i) / 4;
      const hh = h * 0.2;
      groundShadow(g, px, gunwale + 34, 62, 16, 0.16);
      roundRect(g, px - hh * 0.2, gunwale + 34 - hh * 0.66, hh * 0.4, hh * 0.66, hh * 0.14, STRAW, THEME.outline, 5);
      roundRect(g, px - hh * 0.4, gunwale + 34 - hh * 0.52, hh * 0.8, hh * 0.1, hh * 0.04, STRAW, THEME.outline, 4);
      circle(g, px, gunwale + 34 - hh * 0.8, hh * 0.15, STRAW, THEME.outline, 5);
      g.fillStyle(THEME.wood, 1);
      g.fillTriangle(px - hh * 0.2, gunwale + 34 - hh * 0.86, px + hh * 0.2, gunwale + 34 - hh * 0.86, px, gunwale + 34 - hh * 1.06);
      // 扎在草人上的箭
      g.lineStyle(5, THEME.inkSoft, 0.9);
      g.lineBetween(px - 40, gunwale + 10, px + 6, gunwale + 22);
      g.fillStyle(THEME.red, 0.95);
      g.fillTriangle(px - 40, gunwale + 10, px - 50, gunwale + 4, px - 44, gunwale + 18);
    }
    // 雾里飞来的箭雨
    for (let i = 0; i < 4; i += 1) {
      const ay = y + h * (0.16 + i * 0.07);
      g.lineStyle(5, THEME.inkSoft, 0.85);
      g.lineBetween(x + w * 0.06, ay - 10, x + w * 0.4, ay + 6);
      g.fillStyle(THEME.red, 0.9);
      g.fillTriangle(x + w * 0.06, ay - 10, x + w * 0.03, ay - 16, x + w * 0.05, ay - 2);
    }
  }

  // 雾压在最上面 —— 雾里的船
  wavyBand(g, x - 30, y + h * 0.08, w + 60, 160, MIST, 0.46, 26, 2.4);
  wavyBand(g, x - 30, y + h * 0.62, w + 60, 180, MIST, 0.36, 30, 2.2);
}
