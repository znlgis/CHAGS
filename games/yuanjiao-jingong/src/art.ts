import type Phaser from 'phaser';
import { CSS, THEME, circle, groundShadow, roundRect, shade, textStyle, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates/core';
import { matchupOrderBar } from '@chags/templates/matchup';
import type { OrderStageState } from '@chags/templates';
import type { MatchupOrderLevel } from '@chags/templates/schemas';
import {
  CAPITAL, MAP_TOP, NEIGHBOR_RADIUS, PASS, RIBBON_INSET, SIGN_DY, STAKE_INSET,
} from './layout';

/**
 * 第 23 计的地图：**没有交战**。
 *
 * 秦都在图卷中央，一圈城围着它：近的三个在内圈，远的三个在外圈。
 * 近的要"处理"—— 城前立一根界桩；远的先"结好"—— 城与秦都之间系一根结绳。
 * 先做哪一个、后做哪一个，就是这一关要学的事。
 */

const PAPER = 0xf3e4c1;
const PAPER_DEEP = 0xe3cf9f;
const HILL = 0xcbb488;
const RIVER = 0x7cbede;
const CITY = 0xd9a86a;
const CITY_DEEP = 0xb5834a;
const CAPITAL_COLOR = 0xc2554a;

/** 从一座城指向秦都的单位向量：结绳与界桩都沿着它摆 */
function toward(x: number, y: number): { ux: number; uy: number } {
  const dx = CAPITAL.x - x;
  const dy = CAPITAL.y - y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { ux: dx / len, uy: dy / len };
}

/** 一座城：城墙 + 城垛 + 城门（秦都画得大一号、带塔楼） */
function drawCity(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
  capital = false,
): void {
  groundShadow(g, x, y + r * 0.82, r * 2.5, r * 0.5, 0.16);
  // 城墙
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - r, y - r * 0.68, r * 2, r * 1.36, 14);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - r, y - r * 0.68, r * 2, r * 1.36, 14);
  // 城垛
  const step = (r * 2) / 5;
  for (let i = 0; i < 5; i += 1) {
    const bx = x - r + 6 + i * step;
    g.fillStyle(shade(color, 1.06), 1);
    g.fillRect(bx, y - r * 0.68 - r * 0.3, step - 12, r * 0.32);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeRect(bx, y - r * 0.68 - r * 0.3, step - 12, r * 0.32);
  }
  // 城门
  g.fillStyle(shade(color, 0.62), 1);
  g.fillRoundedRect(x - r * 0.32, y - r * 0.06, r * 0.64, r * 0.74, 10);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x - r * 0.32, y - r * 0.06, r * 0.64, r * 0.74, 10);
  if (!capital) return;
  // 秦都：城里再来一座塔楼
  g.fillStyle(shade(color, 1.1), 1);
  g.fillRoundedRect(x - r * 0.3, y - r * 1.72, r * 0.6, r * 1.36, 10);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - r * 0.3, y - r * 1.72, r * 0.6, r * 1.36, 10);
  g.fillStyle(shade(color, 1.2), 1);
  g.fillTriangle(x - r * 0.52, y - r * 1.7, x + r * 0.52, y - r * 1.7, x, y - r * 2.5);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - r * 0.52, y - r * 1.7, x + r * 0.52, y - r * 1.7, x, y - r * 2.5);
}

/** 城头上的一面旗 */
function drawFlag(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
  lean = 0,
): void {
  const px = x + r * 0.85;
  const top = y - r * 1.35;
  g.lineStyle(8, shade(THEME.wood, 0.9), 1);
  g.lineBetween(px, y - r * 0.45, px + lean, top);
  g.fillStyle(color, 1);
  g.fillTriangle(px + lean, top, px + lean, top + 52, px + lean + 52, top + 24);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(px + lean, top, px + lean, top + 52, px + lean + 52, top + 24);
}

/** 城头木牌（称呼用 Text 画，见 citySigns）：木牌本身画在这里 */
function drawSign(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  roundRect(g, x - 62, y + SIGN_DY, 124, 52, 14, THEME.card, THEME.outline, 5);
}

/** 结好：城与秦都之间系一根结绳（绳上打一个结） */
function drawRibbon(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ux: number,
  uy: number,
): void {
  const x1 = x + ux * RIBBON_INSET;
  const y1 = y + uy * RIBBON_INSET;
  const x2 = x1 + ux * 104;
  const y2 = y1 + uy * 104;
  g.lineStyle(13, THEME.card, 0.9);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(9, THEME.gold, 0.95);
  g.lineBetween(x1, y1, x2, y2);
  circle(g, (x1 + x2) / 2, (y1 + y2) / 2, 16, THEME.gold, THEME.outline, 5);
  circle(g, (x1 + x2) / 2, (y1 + y2) / 2, 6, THEME.goldDeep, null, 0);
}

/** 处理：城前立下一根界桩（一块地界牌，不画交战） */
function drawStake(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 6, 78, 20, 0.18);
  g.lineStyle(13, shade(THEME.wood, 1.06), 1);
  g.lineBetween(x, y, x, y - 104);
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x, y, x, y - 104);
  roundRect(g, x - 38, y - 138, 76, 50, 12, THEME.card, THEME.outline, 5);
  g.lineStyle(6, THEME.teal, 1);
  g.lineBetween(x - 22, y - 112, x + 22, y - 112);
}

/** 图卷：纸、远山、河与函谷关 */
function drawParchment(g: Phaser.GameObjects.Graphics): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  g.fillStyle(PAPER, 1);
  g.fillRect(0, MAP_TOP, W, H - MAP_TOP);
  g.fillStyle(PAPER_DEEP, 1);
  g.fillRect(0, H - 26, W, 26);
  g.lineStyle(8, shade(THEME.wood, 0.9), 1);
  g.strokeRect(12, MAP_TOP + 12, W - 24, H - MAP_TOP - 24);

  // 远山（图上四角的几座）
  const hills = [
    { x: 60, y: 250, s: 1 },
    { x: 300, y: 218, s: 0.72 },
    { x: 700, y: 250, s: 0.9 },
    { x: 120, y: 1150, s: 0.8 },
    { x: 620, y: 1160, s: 0.9 },
  ] as const;
  for (const hill of hills) {
    g.fillStyle(HILL, 0.85);
    g.fillTriangle(hill.x - 96 * hill.s, hill.y, hill.x + 96 * hill.s, hill.y, hill.x, hill.y - 118 * hill.s);
    g.lineStyle(5, shade(HILL, 0.82), 1);
    g.strokeTriangle(hill.x - 96 * hill.s, hill.y, hill.x + 96 * hill.s, hill.y, hill.x, hill.y - 118 * hill.s);
  }

  // 河：从西北穿到东南
  wavyBand(g, -20, 560, W + 40, 96, RIVER, 0.85, 14, 2.2, 42);
  g.lineStyle(5, shade(RIVER, 0.82), 0.9);
  g.beginPath();
  g.moveTo(0, 574);
  for (let i = 0; i <= 40; i += 1) {
    g.lineTo((W * i) / 40, 560 + Math.sin((i / 40) * Math.PI * 2 * 2.2) * 14 + 14);
  }
  g.strokePath();

  // 函谷关：秦往东的门（两座小山之间的一道关门）
  circle(g, PASS.x, PASS.y, 34, HILL, THEME.outline, 5);
  circle(g, PASS.x, PASS.y + 66, 28, shade(HILL, 0.92), THEME.outline, 5);
  roundRect(g, PASS.x - 26, PASS.y - 96, 52, 74, 10, shade(THEME.wood, 0.95), THEME.outline, 5);
}

/** 这个世界：图卷、秦都与一圈城（画一次） */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: MatchupOrderLevel): void {
  drawParchment(g);
  for (const neighbor of level.neighbors) {
    drawCity(g, neighbor.x, neighbor.y, NEIGHBOR_RADIUS, CITY);
    drawFlag(g, neighbor.x, neighbor.y, NEIGHBOR_RADIUS, CITY_DEEP);
    drawSign(g, neighbor.x, neighbor.y);
  }
  drawCity(g, CAPITAL.x, CAPITAL.y, CAPITAL.radius, CAPITAL_COLOR, true);
  drawFlag(g, CAPITAL.x, CAPITAL.y, CAPITAL.radius, THEME.gold, -12);
}

/** 每帧重画：已经处理 / 结好的那几座城、走到第几步 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: OrderStageState,
  level: MatchupOrderLevel,
): void {
  for (const neighbor of level.neighbors) {
    if (!stage.picked.includes(neighbor.id)) continue;
    const { ux, uy } = toward(neighbor.x, neighbor.y);
    if (neighbor.stance === 'ally') {
      drawRibbon(g, neighbor.x, neighbor.y, ux, uy);
    } else {
      drawStake(g, neighbor.x + ux * STAKE_INSET, neighbor.y + uy * STAKE_INSET);
      // 城头上的旗换成我们的青色小旗：这一处处理好了
      drawFlag(g, neighbor.x, neighbor.y, NEIGHBOR_RADIUS, THEME.teal);
    }
  }
  matchupOrderBar(g, level, stage.pickedCount);
}

/** 收尾：六座城都跟秦都连起来，地图亮一层金 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: OrderStageState,
  level: MatchupOrderLevel,
): void {
  void stage;
  g.fillStyle(THEME.gold, 0.1);
  g.fillRect(12, MAP_TOP + 12, DESIGN.width - 24, DESIGN.height - MAP_TOP - 24);
  for (const neighbor of level.neighbors) {
    const { ux, uy } = toward(neighbor.x, neighbor.y);
    g.lineStyle(7, THEME.gold, 0.55);
    g.lineBetween(
      neighbor.x + ux * 90,
      neighbor.y + uy * 90,
      CAPITAL.x - ux * 96,
      CAPITAL.y - uy * 96,
    );
  }
  g.lineStyle(9, THEME.gold, 0.6);
  g.strokeCircle(CAPITAL.x, CAPITAL.y, CAPITAL.radius + 54);
}

/** 城头的称呼（双语由内容 JSON 的 label 给；秦都的名字由游戏包按语言传进来） */
export function citySigns(
  scene: Phaser.Scene,
  level: MatchupOrderLevel,
  capitalLabel: string,
): Phaser.GameObjects.Text[] {
  const texts = level.neighbors.map((neighbor) =>
    scene.add
      .text(neighbor.x, neighbor.y + SIGN_DY + 26, neighbor.label, textStyle(30, CSS.ink, true))
      .setOrigin(0.5)
      .setDepth(60),
  );
  texts.push(
    scene.add
      .text(CAPITAL.x, CAPITAL.y + 8, capitalLabel, textStyle(38, CSS.card, true))
      .setOrigin(0.5)
      .setDepth(60),
  );
  return texts;
}

/**
 * 分幕插图：① 范雎摊开地图，对秦昭王说"远的先交好" ② 图上一圈城：
 * 外圈系上结绳、内圈立起界桩，一步一步往外走。
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(PAPER, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.lineStyle(7, shade(THEME.wood, 0.9), 1);
  g.strokeRoundedRect(x + 12, y + 12, w - 24, h - 24, 28);

  if (index === 0) {
    // 地图摊在中间，两个人隔着地图对坐
    roundRect(g, x + w * 0.2, y + h * 0.42, w * 0.6, h * 0.26, 18, PAPER_DEEP, THEME.outline, 5);
    for (const [px, color] of [
      [x + w * 0.14, THEME.red],
      [x + w * 0.86, THEME.teal],
    ] as const) {
      circle(g, px, y + h * 0.36, 30, color, THEME.outline, 5);
      roundRect(g, px - 26, y + h * 0.4, 52, 74, 20, color, THEME.outline, 5);
    }
    // 地图上的两个点：一个近、一个远
    circle(g, x + w * 0.32, y + h * 0.55, 12, CAPITAL_COLOR, THEME.outline, 5);
    circle(g, x + w * 0.68, y + h * 0.5, 12, CITY, THEME.outline, 5);
    g.lineStyle(6, THEME.gold, 0.9);
    g.lineBetween(x + w * 0.36, y + h * 0.55, x + w * 0.62, y + h * 0.51);
    return;
  }

  // 第二幕：一圈城围着中央，外圈系着结绳、内圈插着界桩
  const cx = x + w * 0.5;
  const cy = y + h * 0.54;
  drawCity(g, cx, cy, 42, CAPITAL_COLOR, true);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const near = i < 3;
    const r = near ? 150 : 250;
    const px = cx + Math.cos(angle) * r * 1.05;
    const py = cy + Math.sin(angle) * r * 0.72;
    drawCity(g, px, py, near ? 30 : 26, CITY);
    if (near) {
      drawStake(g, cx + Math.cos(angle) * 96, cy + Math.sin(angle) * 62);
    } else {
      drawRibbon(g, cx + Math.cos(angle) * 80, cy + Math.sin(angle) * 52, Math.cos(angle), Math.sin(angle));
    }
  }
}
