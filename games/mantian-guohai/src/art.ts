import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { RuseStageState } from '@chags/templates';
import type { RuseLevel } from '@chags/templates/schemas';
import { BEAM_LAND, DECK_BOTTOM, DECK_TOP, LAMP, PIER, SHELF_X, SHIP, SKY_BOTTOM } from './layout';

const PAPER = 0xfdf3dc;
const STRAW = 0xe8cd84;
const NET = 0xcbd9e2;
const W = DESIGN.width;
const H = DESIGN.height;

// ---------------- 三件货：大鼓 / 长旗 / 盔甲架 ----------------

/** 货本来的样子（还没套外壳，或者外壳盖不住的时候露出来的那一角） */
function drawBareItem(g: Phaser.GameObjects.Graphics, kind: string): void {
  groundShadow(g, 0, 62, 132, 30, 0.16);
  if (kind === 'drum') {
    roundRect(g, -64, -30, 128, 88, 32, THEME.red, THEME.outline, 6);
    circle(g, -34, 14, 9, THEME.gold, THEME.outline, 4);
    circle(g, 34, 14, 9, THEME.gold, THEME.outline, 4);
    g.lineStyle(6, THEME.goldDeep, 1);
    g.lineBetween(6, -6, 60, -96);
    g.lineBetween(24, -2, 78, -86);
    return;
  }
  if (kind === 'banner') {
    roundRect(g, -12, -104, 24, 156, 10, THEME.wood, THEME.outline, 5);
    roundRect(g, 4, -100, 92, 80, 16, THEME.teal, THEME.outline, 6);
    g.fillStyle(PAPER, 1);
    g.fillTriangle(14, -92, 14, -28, 74, -60);
    return;
  }
  // 盔甲架
  roundRect(g, -14, -24, 28, 82, 12, THEME.wood, THEME.outline, 5);
  roundRect(g, -56, -104, 112, 96, 28, THEME.stone, THEME.outline, 6);
  circle(g, 0, -138, 32, THEME.stone, THEME.outline, 6);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(-14, -152, 14, -152, 0, -186);
}

/** 外壳正合适时，原来那件东西露不出来；不合适时，这一角就支在外面 */
function drawPoking(g: Phaser.GameObjects.Graphics, kind: string): void {
  if (kind === 'banner') {
    roundRect(g, -10, -178, 20, 66, 8, THEME.wood, THEME.outline, 5);
    return;
  }
  if (kind === 'armor') {
    circle(g, 0, -170, 28, THEME.stone, THEME.outline, 6);
    g.fillStyle(THEME.gold, 1);
    g.fillTriangle(-14, -188, 14, -188, 0, -220);
    return;
  }
  // 大鼓：鼓边与两根槌支在外面
  roundRect(g, -70, -128, 140, 34, 16, THEME.red, THEME.outline, 5);
}

/** 外壳：柴捆 / 米袋 / 渔网。w×h 是外壳的大小，alpha 小于 1 就"盖不住" */
function drawCover(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  w: number,
  h: number,
  alpha = 1,
): void {
  const left = -w / 2;
  const top = -h * 0.66;
  const radius = Math.min(w, h) * 0.28;
  if (kind === 'net') {
    roundRect(g, left, top, w, h, radius, NET, THEME.outline, 6, alpha);
    g.lineStyle(4, THEME.inkSoft, 0.75 * alpha);
    for (let i = 1; i < 4; i += 1) {
      g.lineBetween(left + (w * i) / 4, top + 8, left + (w * i) / 4, top + h - 8);
      g.lineBetween(left + 8, top + (h * i) / 4, left + w - 8, top + (h * i) / 4);
    }
    g.lineStyle(7, THEME.wood, alpha);
    g.strokeRoundedRect(left, top, w, h, radius);
    return;
  }
  if (kind === 'sack') {
    roundRect(g, left, top, w, h, radius, PAPER, THEME.outline, 6, alpha);
    roundRect(g, -w * 0.18, top - h * 0.18, w * 0.36, h * 0.22, 12, THEME.sand, THEME.outline, 5, alpha);
    g.lineStyle(7, THEME.redDeep, alpha);
    g.lineBetween(left + w * 0.12, top + h * 0.44, left + w * 0.88, top + h * 0.44);
    return;
  }
  // 柴捆：一捆稻草，两道绳
  roundRect(g, left, top, w, h, radius, STRAW, THEME.outline, 6, alpha);
  g.lineStyle(4, shade(STRAW, 0.84), alpha);
  for (let i = 1; i < 5; i += 1) {
    g.lineBetween(left + (w * i) / 5, top + 10, left + (w * i) / 5, top + h - 10);
  }
  g.lineStyle(8, THEME.wood, alpha);
  g.lineBetween(left + 6, top + h * 0.3, left + w - 6, top + h * 0.3);
  g.lineBetween(left + 6, top + h * 0.72, left + w - 6, top + h * 0.72);
  g.fillStyle(STRAW, alpha);
  for (const dx of [-0.28, 0, 0.28] as const) {
    g.fillTriangle(w * dx - 9, top + 4, w * dx + 9, top + 4, w * dx, top - h * 0.14);
  }
}

/** 一件货：外壳是它此刻套着的那件东西，right = 这个外壳正合适 */
export function drawItem(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  shellKind: string | null,
  right: boolean,
): void {
  if (shellKind === null) {
    drawBareItem(g, kind);
    return;
  }
  // 盖不住的时候先画它本来的样子，透过外壳看得见轮廓 —— 换一个外壳的提示就在这儿
  if (!right) drawBareItem(g, kind);
  drawCover(g, shellKind, 176, 232, right ? 1 : 0.8);
  if (!right) drawPoking(g, kind);
}

/** 外壳摆件：一张卡片，选中它就把这件货装成它的样子 */
export function drawShell(g: Phaser.GameObjects.Graphics, kind: string, chosen: boolean): void {
  roundRect(
    g,
    -54,
    -70,
    108,
    140,
    24,
    chosen ? THEME.paperDeep : THEME.card,
    chosen ? THEME.gold : THEME.outline,
    chosen ? 8 : 5,
  );
  drawCover(g, kind, 82, 100);
}

// ---------------- 景 ----------------

/** 大船：过了检查口的货都往它那儿去 */
function drawShip(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  g.fillStyle(THEME.woodDeep, 1);
  g.fillRoundedRect(x - 160 * s, y - 46 * s, 320 * s, 96 * s, 34 * s);
  g.lineStyle(7 * s, THEME.outline, 1);
  g.strokeRoundedRect(x - 160 * s, y - 46 * s, 320 * s, 96 * s, 34 * s);
  roundRect(g, x - 104 * s, y - 140 * s, 208 * s, 96 * s, 26 * s, THEME.red, THEME.outline, 6 * s);
  roundRect(g, x - 62 * s, y - 214 * s, 124 * s, 78 * s, 22 * s, THEME.gold, THEME.outline, 6 * s);
  for (const dx of [-150, 150] as const) {
    roundRect(g, x + dx * s - 10 * s, y - 90 * s, 20 * s, 60 * s, 9 * s, THEME.wood, THEME.outline, 5 * s);
  }
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(x + 62 * s, y - 300 * s, x + 62 * s, y - 220 * s, x + 168 * s, y - 258 * s);
}

/** 渡口的检查口：两根柱子 + 横梁，货从中间拖过去 */
function drawGate(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
  roundRect(g, x - radius - 30, y - radius - 36, 36, radius * 2 + 36, 14, THEME.wood, THEME.outline, 6);
  roundRect(g, x + radius - 6, y - radius - 36, 36, radius * 2 + 36, 14, THEME.wood, THEME.outline, 6);
  roundRect(g, x - radius - 48, y - radius - 84, radius * 2 + 96, 48, 20, THEME.red, THEME.outline, 6);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(x, y - radius - 60, 14);
}

/** 这个世界：天、海、大船、检查口、栈桥、灯柱（画一次） */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: RuseLevel): void {
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 0, W, SKY_BOTTOM);
  g.fillStyle(THEME.gold, 0.45);
  g.fillCircle(140, 200, 44);
  g.fillStyle(THEME.water, 1);
  g.fillRect(0, SKY_BOTTOM, W, H - SKY_BOTTOM);
  wavyBand(g, -20, SKY_BOTTOM + 60, W + 40, 130, THEME.waterDeep, 0.32, 14, 3);
  wavyBand(g, -20, 1150, W + 40, 240, THEME.waterDeep, 0.3, 18, 2.5);

  drawShip(g, SHIP.x, SHIP.y);
  drawGate(g, level.gate.x, level.gate.y, level.gate.radius);

  // 栈桥：货都摆在桥面的货架上
  roundRect(
    g,
    PIER.left,
    DECK_TOP,
    PIER.right - PIER.left,
    DECK_BOTTOM - DECK_TOP,
    34,
    THEME.wood,
    THEME.outline,
    7,
  );
  g.lineStyle(5, shade(THEME.wood, 0.8), 1);
  for (let y = DECK_TOP + 64; y < DECK_BOTTOM - 24; y += 62) {
    g.lineBetween(PIER.left + 22, y, PIER.right - 22, y);
  }
  for (const x of [90, 260, 430, 600] as const) {
    roundRect(g, x - 22, DECK_BOTTOM - 24, 44, 120, 18, shade(THEME.wood, 0.76), THEME.outline, 6);
  }
  // 货架：三件货一路排下来
  roundRect(
    g,
    SHELF_X - 104,
    DECK_TOP + 16,
    208,
    DECK_BOTTOM - DECK_TOP - 96,
    30,
    shade(THEME.wood, 0.88),
    THEME.outline,
    6,
  );
  // 灯柱
  roundRect(g, LAMP.x - 15, LAMP.y + 34, 30, DECK_TOP - LAMP.y + 20, 13, shade(THEME.wood, 0.84), THEME.outline, 6);
}

/** 每帧：灯光、检查口、已经上船的货 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: RuseStageState,
  level: RuseLevel,
): void {
  const gate = level.gate;
  const lit = state.phase === 'lit';
  const warn = state.phase === 'warn';

  // 检查口：淡淡的金边，拖到这儿就算过了
  g.lineStyle(6, THEME.gold, lit ? 0.7 : 0.4);
  g.strokeCircle(gate.x, gate.y, gate.radius);

  // 灯快亮了：灯泡一点点涨起来
  const near = 1 - state.msToLight / Math.max(1, state.cycleMs);
  if (lit || warn) {
    g.fillStyle(0xfff0bf, warn ? 0.16 : 0.4);
    g.fillTriangle(
      LAMP.x,
      LAMP.y,
      BEAM_LAND.x - 260,
      BEAM_LAND.y + 140,
      BEAM_LAND.x + 220,
      BEAM_LAND.y - 150,
    );
  }
  if (lit) {
    g.fillStyle(0xfff8d8, 0.28);
    g.fillEllipse(BEAM_LAND.x - 30, BEAM_LAND.y, 640, 460);
  }
  if (state.seen.length > 0) {
    g.fillStyle(THEME.red, 0.12);
    g.fillEllipse(BEAM_LAND.x - 30, BEAM_LAND.y, 640, 460);
  }
  circle(
    g,
    LAMP.x,
    LAMP.y,
    lit ? 42 : warn ? 38 : 30,
    lit ? 0xfff3c8 : THEME.gold,
    THEME.outline,
    6,
  );
  if (!lit) {
    g.lineStyle(7, 0xfff3c8, 0.9);
    g.beginPath();
    g.arc(LAMP.x, LAMP.y, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * near, false);
    g.strokePath();
  }

  // 已经过关的货：船边多一件，孩子看得见自己走了一步
  state.passed.forEach((_id, index) => {
    const x = SHIP.x - 96 + (index % 3) * 96;
    const y = SHIP.y + 96;
    roundRect(g, x - 26, y - 30, 52, 60, 16, THEME.gold, THEME.outline, 5);
  });

  if (state.done) {
    g.fillStyle(THEME.gold, 0.18);
    g.fillEllipse(W / 2, (DECK_TOP + DECK_BOTTOM) / 2, 900, 700);
  }
}

/** 收尾：货都上了船，栈桥上一片安静的金光 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _state: RuseStageState,
  level: RuseLevel,
): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(SHIP.x, SHIP.y + 40, 300);
  g.lineStyle(8, THEME.gold, 0.6);
  g.strokeCircle(level.gate.x, level.gate.y, level.gate.radius + 20);
  g.fillStyle(THEME.gold, 0.2);
  g.fillEllipse(BEAM_LAND.x - 30, BEAM_LAND.y, 700, 520);
}

// ---------------- 分幕插图 ----------------

function drawPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  s = 1,
  crown = false,
): void {
  groundShadow(g, x, y + 4 * s, 92 * s, 24 * s, 0.16);
  roundRect(g, x - 32 * s, y - 96 * s, 64 * s, 100 * s, 26 * s, color, THEME.outline, 5 * s);
  circle(g, x, y - 122 * s, 28 * s, 0xf6d3ae, THEME.outline, 5 * s);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x, y - 132 * s, 58 * s, 24 * s);
  if (crown) {
    g.fillStyle(THEME.gold, 1);
    g.fillTriangle(x - 26 * s, y - 148 * s, x - 6 * s, y - 148 * s, x - 16 * s, y - 176 * s);
    g.fillTriangle(x - 10 * s, y - 148 * s, x + 10 * s, y - 148 * s, x, y - 176 * s);
    g.fillTriangle(x + 6 * s, y - 148 * s, x + 26 * s, y - 148 * s, x + 16 * s, y - 176 * s);
  }
}

/** 彩布搭起来的大营 */
function drawTent(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x - w / 2, y, x + w / 2, y, x, y - h);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - w / 2, y, x + w / 2, y, x, y - h);
  g.fillStyle(PAPER, 1);
  for (const dx of [-0.3, 0, 0.3] as const) {
    g.fillTriangle(x + w * dx - 8, y - 4, x + w * dx + 8, y - 4, x + w * dx, y - h * 0.92);
  }
  g.fillStyle(THEME.inkSoft, 1);
  g.fillEllipse(x, y - h * 0.2, w * 0.3, h * 0.42);
  g.fillStyle(THEME.gold, 1);
  g.fillCircle(x, y - h - 12, 12);
}

/** 分幕插图：① 大军到了海边 ② 海边多了一座"大营" */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.water, 1);
  g.fillRoundedRect(x - 20, y + h * 0.5, w + 40, h * 0.52, 26);
  wavyBand(g, x - 20, y + h * 0.56, w + 40, 140, THEME.waterDeep, 0.38, 14, 3);
  g.fillStyle(THEME.gold, 0.4);
  g.fillCircle(x + w * 0.82, y + h * 0.16, 40);

  if (index === 0) {
    // ① 浪太大，皇帝站在岸上不敢上船
    const shoreY = y + h * 0.78;
    g.fillStyle(THEME.sand, 1);
    g.fillEllipse(x + w * 0.3, shoreY + 40, w * 1.1, 220);
    for (const [dx, color] of [[0.16, THEME.teal], [0.3, THEME.teal]] as const) {
      drawPerson(g, x + w * dx, shoreY + 20, color, 0.72);
    }
    drawPerson(g, x + w * 0.44, shoreY + 34, THEME.red, 0.86, true);
    // 船在浪里晃
    g.fillStyle(THEME.woodDeep, 1);
    g.fillRoundedRect(x + w * 0.52, y + h * 0.44, w * 0.42, 74, 30);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeRoundedRect(x + w * 0.52, y + h * 0.44, w * 0.42, 74, 30);
    roundRect(g, x + w * 0.66, y + h * 0.26, 20, 130, 9, THEME.wood, THEME.outline, 5);
    g.fillStyle(PAPER, 1);
    g.fillTriangle(x + w * 0.7, y + h * 0.28, x + w * 0.7, y + h * 0.44, x + w * 0.94, y + h * 0.36);
    return;
  }

  // ② 皇帝笑着走进大营 —— 大营其实早漂在海上
  const tentY = y + h * 0.78;
  g.fillStyle(THEME.sand, 1);
  g.fillEllipse(x + w * 0.36, tentY + 40, w * 1.2, 210);
  drawTent(g, x + w * 0.42, tentY, w * 0.6, h * 0.42);
  drawPerson(g, x + w * 0.2, tentY + 26, THEME.red, 0.8, true);
  // 海面上还漂着一座一模一样的大营
  drawTent(g, x + w * 0.76, y + h * 0.6, w * 0.34, h * 0.24);
  wavyBand(g, x + w * 0.5, y + h * 0.62, w * 0.6, 90, THEME.waterDeep, 0.42, 12, 2.5);
}
