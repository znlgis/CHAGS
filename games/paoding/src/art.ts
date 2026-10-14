import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import type { ButcherPiece } from '@chags/templates/schemas';
import { BOARD_TOP, KNIFE } from './layout';

const HIDE = 0xb9834f;
const HIDE_DARK = 0x8f6136;

export type PieceState = 'whole' | 'seam' | 'grabbed' | 'opened';

/** 一块牛肉（卡通块，不是解剖图）：按 kind 画一点点特征 */
function drawPieceShape(
  g: Phaser.GameObjects.Graphics,
  piece: ButcherPiece,
  state: PieceState,
): void {
  const { x, y, w, h } = piece;
  if (state === 'opened') {
    // 解开的那一块摆在旁边：颜色淡一点，还在画面上
    g.fillStyle(shade(HIDE, 1.08), 0.55);
  } else if (state === 'grabbed') {
    g.fillStyle(shade(HIDE, 1.12), 1);
  } else {
    g.fillStyle(HIDE, 1);
  }
  g.fillEllipse(x, y, w * 2, h * 2);
  g.lineStyle(6, THEME.outline, state === 'opened' ? 0.5 : 1);
  g.strokeEllipse(x, y, w * 2, h * 2);

  if (state !== 'opened') {
    // 亮面：让块看着有厚度
    g.fillStyle(shade(HIDE, 1.14), 0.5);
    g.fillEllipse(x - w * 0.18, y - h * 0.24, w * 1.1, h * 0.7);
  }

  if (piece.kind === 'head') {
    g.fillStyle(shade(HIDE, 0.92), 1);
    g.fillEllipse(x + w * 0.5, y + h * 0.18, w * 0.9, h * 0.8);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeEllipse(x + w * 0.5, y + h * 0.18, w * 0.9, h * 0.8);
    // 角与耳朵
    g.fillStyle(THEME.paperDeep, 1);
    g.fillTriangle(x - w * 0.1, y - h * 0.7, x + w * 0.34, y - h * 1.05, x + w * 0.52, y - h * 0.6);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(x - w * 0.1, y - h * 0.7, x + w * 0.34, y - h * 1.05, x + w * 0.52, y - h * 0.6);
    g.fillStyle(HIDE_DARK, 1);
    g.fillEllipse(x - w * 0.62, y - h * 0.3, w * 0.5, h * 0.34);
  }
  if (piece.kind === 'foreleg' || piece.kind === 'hindleg') {
    g.fillStyle(shade(HIDE, 0.86), 1);
    g.fillRoundedRect(x - w * 0.8, y + h * 0.5, w * 1.6, h * 0.42, 18);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRoundedRect(x - w * 0.8, y + h * 0.5, w * 1.6, h * 0.42, 18);
  }
  if (piece.kind === 'ribs') {
    g.lineStyle(5, shade(HIDE, 0.78), 0.9);
    for (const dx of [-0.5, -0.15, 0.2, 0.55] as const) {
      g.lineBetween(x + w * dx, y - h * 0.7, x + w * dx + 8, y + h * 0.7);
    }
  }
}

/** 整头牛：还在的、正在被推的、已经解开的都画出来 */
export function drawOx(
  g: Phaser.GameObjects.Graphics,
  pieces: ButcherPiece[],
  opened: readonly string[],
  grabbed: string | null,
  seamsLit: boolean,
): void {
  groundShadow(g, 375, 1046, 620, 80, 0.18);
  // 案板
  roundRect(g, 40, BOARD_TOP, 670, 60, 24, THEME.wood, THEME.outline, 7);

  for (const piece of pieces) {
    const isOpened = opened.includes(piece.id);
    const state: PieceState = isOpened
      ? 'opened'
      : grabbed === piece.id
        ? 'grabbed'
        : seamsLit
          ? 'seam'
          : 'whole';
    const target = isOpened ? openedPosition(piece, pieces) : { x: piece.x, y: piece.y };
    const shifted = isOpened
      ? { ...piece, x: target.x, y: target.y, w: piece.w * 0.34, h: piece.h * 0.34 }
      : { ...piece, x: target.x, y: target.y };
    drawPieceShape(g, shifted, state);
    if (state === 'seam') {
      // 缝隙亮了：这一块可以顺着缝推出去
      g.lineStyle(7, THEME.gold, 0.85);
      g.strokeEllipse(shifted.x, shifted.y, shifted.w * 2 + 16, shifted.h * 2 + 16);
    }
  }
}

/** 解开的那一块滑到案板下方排好 —— 一眼看得出"解开了几块" */
function openedPosition(piece: ButcherPiece, pieces: ButcherPiece[]): { x: number; y: number } {
  const index = pieces.findIndex((p) => p.id === piece.id);
  const columns = 4;
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: 130 + col * 165, y: 1150 + row * 130 };
}

/** 顺着缝的箭头：拿起来的时候才出现 */
export function drawGrooveArrow(
  g: Phaser.GameObjects.Graphics,
  piece: ButcherPiece,
  length = 150,
): void {
  const rad = (piece.grooveDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const x0 = piece.x + dx * (piece.radius + 26);
  const y0 = piece.y + dy * (piece.radius + 26);
  const x1 = x0 + dx * length;
  const y1 = y0 + dy * length;
  g.lineStyle(10, THEME.gold, 0.95);
  g.lineBetween(x0, y0, x1, y1);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(
    x1 + dx * 34, y1 + dy * 34,
    x1 - dx * 10 - dy * 26, y1 - dy * 10 + dx * 26,
    x1 - dx * 10 + dy * 26, y1 - dy * 10 - dx * 26,
  );
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(
    x1 + dx * 34, y1 + dy * 34,
    x1 - dx * 10 - dy * 26, y1 - dy * 10 + dx * 26,
    x1 - dx * 10 + dy * 26, y1 - dy * 10 - dx * 26,
  );
}

/** 右下角那把刀：刀口上有没有缺口，一眼看得见 */
export function drawKnife(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  nicks: number,
  shiny: boolean,
): void {
  roundRect(g, x - 130, y - 26, 240, 52, 24, THEME.stone, THEME.outline, 6);
  // 刀刃
  g.fillStyle(0xe8eef5, 1);
  g.fillTriangle(x + 84, y - 40, x + 158, y, x + 84, y + 40);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x + 84, y - 40, x + 158, y, x + 84, y + 40);
  // 刀柄
  roundRect(g, x - 150, y - 22, 130, 44, 18, THEME.wood, THEME.outline, 6);
  for (let i = 0; i < nicks; i += 1) {
    g.fillStyle(THEME.outline, 1);
    g.fillTriangle(
      x + 96 + i * 20, y - 34,
      x + 116 + i * 20, y - 34,
      x + 106 + i * 20, y - 8,
    );
  }
  if (shiny) {
    g.lineStyle(6, THEME.gold, 0.75);
    g.lineBetween(x + 96, y - 44, x + 150, y - 30);
  }
}

/** 收尾：一张完整的骨架摊在灯下，刀挂在一旁 */
export function drawFinale(g: Phaser.GameObjects.Graphics, pieces: ButcherPiece[]): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(375, 640, 400);
  // 骨架：按原位填成骨色 —— 骨肉都顺着缝分开了，只剩这一张
  for (const piece of pieces) {
    g.fillStyle(0xf6efdc, 1);
    g.fillEllipse(piece.x, piece.y, piece.w * 2, piece.h * 2);
    g.lineStyle(8, 0xd8c7a0, 1);
    g.strokeEllipse(piece.x, piece.y, piece.w * 2, piece.h * 2);
  }
  // 脊骨：一条线串起整张骨架
  g.lineStyle(12, 0xe8dcbc, 1);
  g.lineBetween(140, 548, 600, 548);
  g.lineStyle(5, 0xcbb98e, 1);
  for (let x = 170; x < 600; x += 46) {
    g.lineBetween(x, 522, x, 574);
  }
  // 刀擦干净了，挂在一旁
  drawKnife(g, KNIFE.x, KNIFE.y, 0, true);
  g.lineStyle(7, THEME.gold, 0.65);
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    g.lineBetween(
      KNIFE.x + Math.cos(angle) * 150,
      KNIFE.y + Math.sin(angle) * 150,
      KNIFE.x + Math.cos(angle) * 200,
      KNIFE.y + Math.sin(angle) * 200,
    );
  }
}

/** 分幕插图：① 庖丁解牛，骨肉"哗"地分开 ② 文惠君看呆了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sand, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.86), 1);
  g.fillRoundedRect(x - 20, y + h * 0.78, w + 40, h * 0.26, 30);

  if (index === 0) {
    // 一头牛 + 一把刀：刀正顺着缝走
    g.fillStyle(HIDE, 1);
    g.fillEllipse(x + w * 0.5, y + h * 0.42, w * 0.6, h * 0.3);
    g.lineStyle(7, THEME.outline, 1);
    g.strokeEllipse(x + w * 0.5, y + h * 0.42, w * 0.6, h * 0.3);
    g.fillStyle(HIDE_DARK, 1);
    g.fillEllipse(x + w * 0.78, y + h * 0.36, w * 0.22, h * 0.2);
    g.fillStyle(THEME.stone, 1);
    g.fillTriangle(x + w * 0.3, y + h * 0.6, x + w * 0.46, y + h * 0.66, x + w * 0.3, y + h * 0.72);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(x + w * 0.3, y + h * 0.6, x + w * 0.46, y + h * 0.66, x + w * 0.3, y + h * 0.72);
  } else {
    // 文惠君：一个看呆了的人，旁边一把新刀
    groundShadow(g, x + w * 0.38, y + h * 0.84, 150, 34, 0.16);
    roundRect(g, x + w * 0.38 - 48, y + h * 0.5, 96, 190, 34, THEME.teal, THEME.outline, 6);
    circle(g, x + w * 0.38, y + h * 0.4, 40, 0xf6d3ae, THEME.outline, 6);
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(x + w * 0.38, y + h * 0.35, 84, 34);
    g.fillCircle(x + w * 0.38 - 13, y + h * 0.41, 5);
    g.fillCircle(x + w * 0.38 + 13, y + h * 0.41, 5);
    drawKnife(g, x + w * 0.62, y + h * 0.66, 0, true);
  }
}
