import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import type { TwolinePlantStageState } from '@chags/templates';
import type { TwolinePlantLevel } from '@chags/templates/schemas';
import { BELL, DESK, LANTERN, SKY_TOP, TENT, VISITOR_RADIUS, WALK_MS } from './layout';
import { clamp01 } from '@chags/game-kit';

const W = DESIGN.width;
const H = DESIGN.height;
/** 帐外的夜色与帐里的暖光 */
const NIGHT = shade(THEME.skyDeep, 0.46);
const CLOTH = shade(THEME.sand, 0.94);
const CLOTH_DEEP = shade(THEME.sandDeep, 0.9);
const FLOOR = shade(THEME.sandDeep, 0.78);
const WOOD = THEME.wood;
const WOOD_DEEP = THEME.woodDeep;
const SKIN = 0xf8dcbb;
const ROBE = shade(THEME.teal, 0.88);
const ROBE_DEEP = shade(THEME.tealDeep, 1.02);
const LACQUER = shade(THEME.red, 0.94);
const BRONZE = shade(THEME.goldDeep, 1.06);
const MOONLIGHT = 0xfff6d8;


// ---------------- 帐里的几样东西 ----------------

/** 帐里那盏灯：火苗按时间晃 */
function drawLantern(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void {
  groundShadow(g, x, y + 6, 96, 22, 0.16);
  roundRect(g, x - 34, y + 2, 68, 18, 8, WOOD_DEEP, THEME.outline, 5);
  g.lineStyle(8, WOOD_DEEP, 1);
  g.lineBetween(x, y - 42, x, y + 2);
  const sway = Math.sin(t / 420) * 3;
  g.fillStyle(THEME.gold, 0.2);
  g.fillCircle(x + sway, y - 62, 46);
  roundRect(g, x - 22 + sway, y - 84, 44, 46, 14, THEME.gold, THEME.outline, 5);
  g.fillStyle(MOONLIGHT, 0.85);
  g.fillEllipse(x + sway, y - 62, 16, 22);
}

/** 帐角的木架与那串铜铃（rung > 0 = 铃还在晃：这一下动静就是他转头的理由） */
function drawBell(g: Phaser.GameObjects.Graphics, rung: number): void {
  const { x, y } = BELL;
  const swing = Math.sin(rung * Math.PI * 4) * 14 * rung;
  groundShadow(g, x, y + 100, 170, 30, 0.16);
  // 木架：一根立柱 + 一根横梁
  roundRect(g, x - 98, y - 12, 22, 118, 10, WOOD_DEEP, THEME.outline, 5);
  roundRect(g, x - 98, y - 36, 180, 24, 10, WOOD, THEME.outline, 5);
  // 挂绳与铃
  g.lineStyle(6, THEME.inkSoft, 1);
  g.lineBetween(x + 22, y - 24, x + 22 + swing, y + 24);
  const bx = x + 22 + swing;
  g.fillStyle(BRONZE, 1);
  g.beginPath();
  g.moveTo(bx - 40, y + 88);
  g.lineTo(bx - 27, y + 26);
  g.lineTo(bx + 27, y + 26);
  g.lineTo(bx + 40, y + 88);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(shade(BRONZE, 1.14), 1);
  g.fillEllipse(bx, y + 88, 84, 20);
  g.fillStyle(WOOD_DEEP, 1);
  g.fillRect(bx - 8, y + 92, 16, 28); // 铃舌
  // 刚响过：两圈还没散开的波纹
  if (rung > 0) {
    g.lineStyle(5, THEME.gold, 0.5 * rung);
    g.strokeCircle(bx, y + 56, 58 + 40 * (1 - rung));
    g.lineStyle(4, THEME.gold, 0.3 * rung);
    g.strokeCircle(bx, y + 56, 84 + 54 * (1 - rung));
  }
}

/** 那张案：案面 + 四条腿（案上那件东西由 drawGift 画） */
function drawDesk(g: Phaser.GameObjects.Graphics): void {
  groundShadow(g, DESK.x + DESK.w / 2, DESK.y + DESK.h + 30, DESK.w + 40, 40, 0.16);
  for (const dx of [0.1, 0.9]) {
    const legX = DESK.x + DESK.w * dx;
    roundRect(g, legX - 16, DESK.y + DESK.h - 40, 32, 96, 10, WOOD_DEEP, THEME.outline, 5);
  }
  roundRect(g, DESK.x, DESK.y, DESK.w, DESK.h, 22, WOOD, THEME.outline, 6);
  g.fillStyle(shade(WOOD, 1.12), 0.55);
  g.fillRect(DESK.x + 18, DESK.y + 16, DESK.w - 36, 18);
  // 案沿的一道漆边
  g.fillStyle(LACQUER, 0.9);
  g.fillRect(DESK.x + 8, DESK.y + DESK.h - 30, DESK.w - 16, 16);
}

/**
 * 案上那件东西：摆到 ratio 就立起来几分。
 * 还没动手的时候（ratio = 0）案上只有四个角上的浅痕 —— 孩子一眼知道该摆哪儿。
 */
function drawGift(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ratio: number,
  planted: boolean,
): void {
  const k = planted ? 1 : clamp01(ratio);
  if (k <= 0) {
    const s = 74;
    g.lineStyle(6, 0xffffff, 0.26);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      g.lineBetween(x + sx * s, y + sy * s, x + sx * (s - 30), y + sy * s);
      g.lineBetween(x + sx * s, y + sy * s, x + sx * s, y + sy * (s - 30));
    }
    return;
  }
  const scale = 0.7 + 0.3 * k;
  const w = 150 * scale;
  const h = 104 * scale;
  const alpha = 0.5 + 0.5 * k;
  groundShadow(g, x, y + h / 2 + 8, w + 26, 26 * scale, 0.14 * alpha);
  // 漆盒
  roundRect(g, x - w / 2, y - h / 2, w, h, 20, LACQUER, THEME.outline, 6, alpha);
  g.fillStyle(BRONZE, alpha);
  g.fillRect(x - w / 2 + 8, y - h / 2 + 10, w - 16, 12);
  g.fillRect(x - w / 2 + 8, y + h / 2 - 22, w - 16, 12);
  // 盒上压着的那支竹简：一眼看出这是"要给谁看"的东西
  const slip = 86 * scale;
  roundRect(g, x - slip / 2, y - slip, slip, slip * 0.5, 8, shade(THEME.sand, 1.04), THEME.outline, 4, alpha);
  g.lineStyle(4, THEME.inkSoft, 0.75 * alpha);
  for (let i = 0; i < 3; i += 1) {
    const ly = y - slip + 9 * scale + i * 11 * scale;
    g.lineBetween(x - slip / 2 + 10, ly, x + slip / 2 - 10, ly);
  }
  if (planted) {
    g.lineStyle(8, THEME.gold, 0.85);
    g.strokeRoundedRect(x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20, 24);
  }
}

/**
 * 使者：脚站在 (x, y)。away = 他正转过头去看别处（只看得见后脑勺）。
 * phase 是走路的相位 —— 一摇一晃，看得出他在踱步。
 */
function drawVisitor(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  away: boolean,
  phase: number,
): void {
  const sway = Math.sin(phase) * 4;
  groundShadow(g, x + sway, y + 4, VISITOR_RADIUS + 8, 28, 0.18);
  // 手里的节杖（他是项王派来的人）
  g.lineStyle(8, WOOD_DEEP, 1);
  g.lineBetween(x + 40 + sway, y - 104, x + 40 + sway, y - 6);
  g.fillStyle(BRONZE, 1);
  g.fillCircle(x + 40 + sway, y - 112, 13);
  // 官袍
  roundRect(g, x - 34 + sway, y - 110, 68, 112, 24, ROBE, THEME.outline, 6);
  g.fillStyle(ROBE_DEEP, 1);
  g.fillRect(x - 30 + sway, y - 66, 60, 14);
  g.lineStyle(7, THEME.gold, 1);
  g.lineBetween(x - 30 + sway, y - 66, x + 30 + sway, y - 66);
  const headX = x + sway + (away ? -16 : 0);
  circle(g, headX, y - 136, 27, SKIN, THEME.outline, 6);
  roundRect(g, headX - 29, y - 168, 58, 17, 8, THEME.inkSoft, THEME.outline, 5);
  g.fillStyle(THEME.outline, 1);
  if (away) {
    // 转过头去：两只眼睛挤在一侧（后脑勺朝我们）
    g.fillCircle(headX - 15, y - 136, 3.4);
    g.fillCircle(headX - 8, y - 134, 3.4);
  } else {
    g.fillCircle(headX - 9, y - 138, 3.6);
    g.fillCircle(headX + 9, y - 138, 3.6);
  }
}

/** 他瞟一眼案上：从眼睛到案上那几点（他正看着的时候才有） */
function drawGaze(
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const eye = { x: from.x, y: from.y - 140 };
  g.fillStyle(THEME.inkSoft, 0.42);
  for (let i = 1; i <= 3; i += 1) {
    const p = i / 4;
    g.fillCircle(eye.x + (to.x - eye.x) * p, eye.y + (to.y - eye.y) * p, 5 - i * 0.7);
  }
}

// ---------------- 景（画一次） ----------------

/** 这个世界：帐外的夜、帐幕、地席上他踱出来的那条痕、那张案、帐角的铜铃、帐里的灯 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: TwolinePlantLevel): void {
  // 帐外的夜与几颗星
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, SKY_TOP, W, H - SKY_TOP);
  for (const [sx, sy] of [
    [92, 214],
    [212, 180],
    [520, 196],
    [668, 244],
    [712, 300],
  ] as const) {
    g.fillStyle(MOONLIGHT, 0.8);
    g.fillCircle(sx, sy, 3.4);
  }
  g.fillStyle(MOONLIGHT, 0.14);
  g.fillCircle(640, 250, 76);
  circle(g, 640, 250, 42, MOONLIGHT, null, 0);

  // 帐幕：一块从顶上垂下来的布，两侧各一道帐柱
  g.fillStyle(CLOTH, 1);
  g.fillRect(TENT.left, TENT.top, TENT.right - TENT.left, TENT.bottom - TENT.top);
  g.fillStyle(CLOTH_DEEP, 1);
  g.fillRect(TENT.left, TENT.top, 44, TENT.bottom - TENT.top);
  g.fillRect(TENT.right - 44, TENT.top, 44, TENT.bottom - TENT.top);
  // 帐顶的横梁与两头的铜环
  roundRect(g, TENT.left - 16, TENT.top - 34, TENT.right - TENT.left + 32, 40, 14, WOOD_DEEP, THEME.outline, 6);
  for (const bx of [TENT.left + 6, TENT.right - 6]) {
    circle(g, bx, TENT.top + 8, 13, BRONZE, THEME.outline, 4);
  }
  // 帐幔上的几道褶
  g.lineStyle(5, CLOTH_DEEP, 0.5);
  for (let x = TENT.left + 96; x < TENT.right - 60; x += 96) {
    g.lineBetween(x, TENT.top + 6, x - 22, TENT.bottom - 6);
  }

  // 地席：从案前一直铺到帐底（他就在这块席上来回走）
  const matTop = DESK.y + DESK.h + 44;
  g.fillStyle(FLOOR, 1);
  g.fillRect(TENT.left + 44, matTop, TENT.right - TENT.left - 88, TENT.bottom - 30 - matTop);
  g.lineStyle(5, shade(FLOOR, 0.84), 0.8);
  for (let y = matTop + 60; y < TENT.bottom - 60; y += 70) {
    g.lineBetween(TENT.left + 70, y, TENT.right - 70, y - 12);
  }
  // 他踱步踩出来的那道浅痕：两头就是关卡数据里的 from / to
  g.lineStyle(30, shade(FLOOR, 0.88), 0.55);
  g.lineBetween(level.visitor.from.x, level.visitor.from.y + 12, level.visitor.to.x, level.visitor.to.y + 12);

  drawDesk(g);
  drawBell(g, 0);
  drawLantern(g, LANTERN.x, LANTERN.y, 0);
}

// ---------------- 每帧 ----------------

/** 每帧：他踱到哪儿了、头转过去没有、案上摆到几成了、空档还剩多久 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: TwolinePlantStageState,
  level: TwolinePlantLevel,
): void {
  const away = state.lookingAway;
  // 铜铃：他正看着别处的时候铃还在晃（就是这一下动静把他引开的）
  const rung =
    away && level.redirect.lookAwayMs > 0
      ? clamp01(state.lookAwayLeftMs / level.redirect.lookAwayMs)
      : 0;
  drawBell(g, rung);

  // 案上那件东西：按着摆到几成，它就立起来几成
  drawGift(g, level.spot.x, level.spot.y, state.plantRatio, state.planted);

  // 他：踱到哪儿了、头转过去没有
  drawVisitor(g, state.visitorAt.x, state.visitorAt.y, away, (state.elapsedMs / WALK_MS) * Math.PI * 2);

  // 他正看着的时候：目光落在案上（"现在不能动手"）
  if (!away && !state.done) drawGaze(g, state.visitorAt, { x: level.spot.x, y: level.spot.y });

  // 空档的钟：铃下面那一圈刻度 —— 离他回头越近，圈越空
  if (!state.done) {
    const left =
      level.redirect.lookAwayMs > 0 ? clamp01(state.lookAwayLeftMs / level.redirect.lookAwayMs) : 0;
    const cx = BELL.x + BELL.radius + 60;
    const cy = BELL.y + 40;
    g.lineStyle(7, THEME.inkSoft, 0.3);
    g.strokeCircle(cx, cy, 32);
    if (left > 0) {
      g.lineStyle(9, left > 0.5 ? THEME.teal : THEME.gold, 0.92);
      g.beginPath();
      g.arc(cx, cy, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      g.strokePath();
    }
  }

  // 手指按着的时候：案上补一点"用着力"的暖光（那圈进度环由模板的 mark 层画）
  if (state.holding) {
    g.fillStyle(THEME.gold, 0.14);
    g.fillCircle(level.spot.x, level.spot.y, level.spot.radius + 26);
  }
}

/** 收尾：东西摆好了，他回头正看着案上 —— 这一句是他自己要说的 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: TwolinePlantStageState,
  level: TwolinePlantLevel,
): void {
  g.fillStyle(THEME.gold, 0.16);
  g.fillEllipse(level.spot.x, level.spot.y + 40, 760, 560);
  drawGift(g, level.spot.x, level.spot.y, 1, true);
  drawVisitor(g, state.visitorAt.x, state.visitorAt.y, false, 0);
  drawGaze(g, state.visitorAt, { x: level.spot.x, y: level.spot.y });
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(level.spot.x, level.spot.y, level.spot.radius + 40);
}

// ---------------- 分幕插图 ----------------

/** 插图里的一个小人（比正片小一号，按插图矩形自己算） */
function drawBeatFigure(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  color: number,
  turned: boolean,
): void {
  groundShadow(g, x, y + 3 * scale, 62 * scale, 16 * scale, 0.16);
  roundRect(g, x - 20 * scale, y - 66 * scale, 40 * scale, 68 * scale, 14 * scale, color, THEME.outline, 5);
  circle(g, x, y - 84 * scale, 16 * scale, SKIN, THEME.outline, 5);
  roundRect(g, x - 18 * scale, y - 104 * scale, 36 * scale, 11 * scale, 5, THEME.inkSoft, THEME.outline, 4);
  g.fillStyle(THEME.outline, 1);
  if (turned) {
    g.fillCircle(x - 9 * scale, y - 84 * scale, 2.4 * scale);
    g.fillCircle(x - 5 * scale, y - 83 * scale, 2.4 * scale);
  } else {
    g.fillCircle(x - 6 * scale, y - 85 * scale, 2.6 * scale);
    g.fillCircle(x + 6 * scale, y - 85 * scale, 2.6 * scale);
  }
}

/** 插图里的案：gift = 案上摆了那件东西（不然就是几盘酒菜） */
function drawBeatDesk(
  g: Phaser.GameObjects.Graphics,
  left: number,
  right: number,
  y: number,
  gift: boolean,
): void {
  const w = right - left;
  roundRect(g, left, y, w, 40, 12, WOOD, THEME.outline, 5);
  for (const dx of [0.08, 0.92]) {
    roundRect(g, left + w * dx - 10, y + 34, 20, 46, 8, WOOD_DEEP, THEME.outline, 4);
  }
  if (gift) {
    roundRect(g, left + w * 0.42, y - 44, 96, 52, 12, LACQUER, THEME.outline, 5);
    roundRect(g, left + w * 0.45, y - 78, 72, 36, 8, shade(THEME.sand, 1.04), THEME.outline, 4);
    return;
  }
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle(shade(THEME.paper, 0.98), 1);
    g.fillEllipse(left + w * (0.2 + i * 0.16), y + 2, 46, 16);
    g.lineStyle(3, THEME.outline, 0.5);
    g.strokeEllipse(left + w * (0.2 + i * 0.16), y + 2, 46, 16);
  }
}

/**
 * 分幕插图：① 案上摆着好酒菜，使者掀帘进来 ② 使者回去，把他自己看到的说出来
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(shade(NIGHT, 1.08), 1);
  g.fillRoundedRect(x, y, w, h, 34);
  // 帐顶
  g.fillStyle(CLOTH, 1);
  g.fillTriangle(x - 18, y + h * 0.32, x + w + 18, y + h * 0.32, x + w / 2, y + h * 0.03);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 18, y + h * 0.32, x + w + 18, y + h * 0.32, x + w / 2, y + h * 0.03);
  // 地席
  g.fillStyle(FLOOR, 1);
  g.fillRect(x, y + h * 0.66, w, h * 0.34);
  g.lineStyle(4, shade(FLOOR, 0.84), 0.8);
  for (let i = 1; i < 4; i += 1) {
    g.lineBetween(x, y + h * (0.66 + i * 0.08), x + w, y + h * (0.66 + i * 0.08));
  }

  if (index === 0) {
    // ① 案上摆着好酒菜，使者掀帘进来（他还没看见那件东西）
    drawBeatDesk(g, x + w * 0.14, x + w * 0.86, y + h * 0.56, false);
    drawBeatFigure(g, x + w * 0.74, y + h * 0.9, 1, ROBE, false);
    // 掀开的帐帘一角
    g.fillStyle(CLOTH_DEEP, 1);
    g.fillTriangle(x + w * 0.06, y + h * 0.1, x + w * 0.3, y + h * 0.24, x + w * 0.06, y + h * 0.44);
    g.lineStyle(7, CLOTH_DEEP, 1);
    g.lineBetween(x + w * 0.06, y + h * 0.1, x + w * 0.06, y + h * 0.72);
    return;
  }

  // ② 使者回去了：他指着案上（"我看到的是这样"），听的人皱着眉
  drawBeatDesk(g, x + w * 0.12, x + w * 0.72, y + h * 0.58, true);
  drawBeatFigure(g, x + w * 0.3, y + h * 0.92, 1, ROBE, false);
  g.lineStyle(8, SKIN, 1); // 他伸手指着案上
  g.lineBetween(x + w * 0.34, y + h * 0.8, x + w * 0.5, y + h * 0.7);
  drawBeatFigure(g, x + w * 0.8, y + h * 0.92, 1.08, shade(THEME.redDeep, 1.06), false);
  // 皱眉与头上的一个问号
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x + w * 0.75, y + h * 0.62, x + w * 0.85, y + h * 0.655);
  const qx = x + w * 0.88;
  const qy = y + h * 0.34;
  g.lineStyle(8, THEME.inkSoft, 0.9);
  g.beginPath();
  g.arc(qx, qy, 20, Math.PI * 0.9, Math.PI * 2.1);
  g.strokePath();
  g.lineBetween(qx + 16, qy + 12, qx + 5, qy + 30);
  g.fillStyle(THEME.inkSoft, 1);
  g.fillCircle(qx + 3, qy + 48, 6);
}
