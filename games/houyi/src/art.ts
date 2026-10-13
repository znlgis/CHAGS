import type Phaser from 'phaser';
import { THEME, circle, roundRect, shade } from '@chags/phaser-kit';

/** 太阳：烤焦大地的是火红，只剩一个时变温柔的金黄 */
export function drawSun(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  warm: boolean,
): void {
  const color = warm ? 0xf7c948 : 0xe8652c;
  g.lineStyle(7, color, 1);
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    g.lineBetween(x + Math.cos(a) * 52, y + Math.sin(a) * 52, x + Math.cos(a) * 74, y + Math.sin(a) * 74);
  }
  g.fillStyle(color, 1);
  g.fillCircle(x, y, 48);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeCircle(x, y, 48);
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(x - 16, y - 16, 13);
}

export function drawScenery(
  g: Phaser.GameObjects.Graphics,
  stage: { width: number; height: number },
  dry: boolean,
): void {
  const groundY = 1000;

  g.fillStyle(dry ? 0xf0d9a8 : THEME.sky, 1);
  if (dry) {
    // 焦黄的天空
    g.fillStyle(0xf3ddb0, 1);
    g.fillRect(0, 150, stage.width, groundY - 150);
  } else {
    g.fillStyle(THEME.sky, 1);
    g.fillRect(0, 150, stage.width, groundY - 150);
  }

  roundRect(
    g,
    -40,
    groundY,
    stage.width + 80,
    stage.height - groundY + 60,
    { tl: 60, tr: 60, bl: 0, br: 0 },
    dry ? 0xd9c08a : THEME.leaf,
    THEME.outline,
    7,
  );

  if (dry) {
    // 干裂的纹路
    g.lineStyle(5, 0xb99a63, 1);
    for (const [x0, y0] of [[120, 1080], [300, 1160], [520, 1070], [660, 1180]] as const) {
      g.lineBetween(x0, y0, x0 + 70, y0 + 45);
      g.lineBetween(x0 + 35, y0 + 4, x0 + 10, y0 + 60);
    }
  } else {
    // 抽芽的草木
    g.lineStyle(8, THEME.leaf, 1);
    for (const x of [110, 220, 330, 470, 590, 680] as const) {
      g.beginPath();
      g.moveTo(x, 1260);
      g.lineTo(x + 6, 1190);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + 6, 1220);
      g.lineTo(x + 34, 1198);
      g.strokePath();
    }
  }
}

/** 后羿：拉弓的姿势，pull 决定弦拉开多少 */
export function drawArcher(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pull: number,
): void {
  roundRect(g, x - 30, y + 26, 24, 70, 11, shade(THEME.red, 0.78), THEME.outline, 5);
  roundRect(g, x + 6, y + 26, 24, 70, 11, shade(THEME.red, 0.78), THEME.outline, 5);
  roundRect(g, x - 32, y - 50, 64, 88, 24, THEME.red, THEME.outline, 6);

  const bowX = x + 66;
  const bowY = y - 26;
  g.lineStyle(9, THEME.woodDeep, 1);
  g.beginPath();
  g.arc(bowX, bowY, 56, -Math.PI * 0.62, Math.PI * 0.62, false);
  g.strokePath();

  const back = 16 + pull * 40;
  g.lineStyle(4, THEME.ink, 1);
  g.lineBetween(bowX + 20, bowY - 48, bowX - back, bowY);
  g.lineBetween(bowX - back, bowY, bowX + 20, bowY + 48);

  // 手臂
  g.lineStyle(13, THEME.red, 1);
  g.beginPath();
  g.moveTo(x + 20, y - 30);
  g.lineTo(bowX - back * 0.4, bowY);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + 14, y - 34);
  g.lineTo(bowX + 6, bowY - 44);
  g.strokePath();

  if (pull > 0.05) {
    g.lineStyle(6, THEME.ink, 1);
    g.lineBetween(bowX - back, bowY, bowX + 50, bowY);
  }

  circle(g, x, y - 82, 30, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  for (let i = -2; i <= 2; i += 1) g.fillCircle(x + i * 11, y - 108, 8);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 10, y - 84, 4);
  g.fillCircle(x + 10, y - 84, 4);
}

/** 分幕插图 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(0xf3ddb0, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(0xd9c08a, 1);
  g.fillRect(x, y + h - 120, w, 120);

  if (index === 0) {
    for (let i = 0; i < 10; i += 1) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      drawSun(g, x + 90 + col * 116, y + 110 + row * 150, false);
    }
    g.lineStyle(5, 0xb99a63, 1);
    for (const dx of [70, 200, 330, 460] as const) {
      g.lineBetween(x + dx, y + h - 90, x + dx + 60, y + h - 45);
    }
  } else {
    drawSun(g, x + w - 120, y + 120, false);
    drawArcher(g, x + 190, y + h - 250, 0.8);
  }
}
