import type Phaser from 'phaser';
import { THEME } from './theme';

const OUTLINE_WIDTH = 6;

type Radius = number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius;
/** 既能是 Container 也能是 Graphics/Text 的淡入目标（它们用的是单值 Alpha） */
export type Fadeable = Phaser.GameObjects.GameObject & {
  alpha: number;
  setAlpha(value: number): unknown;
};

/** 圆角矩形：卡通风格一律“有底有边” */
export function roundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: Radius,
  fill: number,
  outline: number | null = THEME.outline,
  outlineWidth = OUTLINE_WIDTH,
  alpha = 1,
): void {
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (outline !== null && outlineWidth > 0) {
    g.lineStyle(outlineWidth, outline, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

export function circle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  fill: number,
  outline: number | null = THEME.outline,
  outlineWidth = 5,
  alpha = 1,
): void {
  g.fillStyle(fill, alpha);
  g.fillCircle(x, y, r);
  if (outline !== null && outlineWidth > 0) {
    g.lineStyle(outlineWidth, outline, 1);
    g.strokeCircle(x, y, r);
  }
}

/** 物体底下的柔和阴影，圆润卡通的关键“落地感” */
export function groundShadow(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  alpha = 0.16,
): void {
  g.fillStyle(THEME.outline, alpha);
  g.fillEllipse(cx, cy, w, h);
}

/** 波浪水面（用折线逼近，避免依赖曲线 API） */
export function wavyBand(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
  amplitude = 12,
  waves = 2.5,
  segments = 40,
): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i <= segments; i += 1) {
    const px = x + (w * i) / segments;
    const py = y + Math.sin((i / segments) * Math.PI * 2 * waves) * amplitude;
    g.lineTo(px, py);
  }
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fillPath();
}

/** 挤压回弹：给拖放一个“有重量”的手感 */
export function squash(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  base = 1,
  strength = 0.16,
): void {
  scene.tweens.add({
    targets: target,
    scaleX: base * (1 + strength),
    scaleY: base * (1 - strength),
    duration: 90,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

export function popIn(scene: Phaser.Scene, target: Fadeable, delay = 0): void {
  target.setAlpha(0);
  scene.tweens.add({
    targets: target,
    alpha: 1,
    duration: 260,
    delay,
    ease: 'Quad.easeOut',
  });
}

/** 颜色加深/变浅，用来做按钮的“厚度”和物体的亮暗面 */
export function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** 星光反馈，替代“答对了”这类文字 */
export function sparkleAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = THEME.gold,
  count = 5,
): void {
  for (let i = 0; i < count; i += 1) {
    const g = scene.add.graphics().setDepth(900);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, 9);
    g.lineStyle(5, color, 1);
    g.lineBetween(-24, 0, 24, 0);
    g.lineBetween(0, -24, 0, 24);
    const angle = (Math.PI * 2 * i) / count;
    g.setPosition(x + Math.cos(angle) * 40, y + Math.sin(angle) * 40);
    scene.tweens.add({
      targets: g,
      x: x + Math.cos(angle) * 150,
      y: y + Math.sin(angle) * 150,
      scale: 0.2,
      alpha: 0,
      duration: 620,
      delay: i * 40,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }
}

/** “点这里”的扩散涟漪，代替提示文字 */
export function tapRipple(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius = 46,
  color: number = THEME.red,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(800);
  let acc = 0;

  const draw = (phaseBase: number): void => {
    g.clear();
    for (let i = 0; i < 2; i += 1) {
      const phase = (phaseBase + i * 0.5) % 1;
      g.lineStyle(5, color, (1 - phase) * 0.9);
      g.strokeCircle(x, y, radius * (0.5 + phase * 0.9));
    }
  };

  const onUpdate = (_time: number, delta: number): void => {
    acc += delta;
    draw((acc % 1600) / 1600);
  };
  scene.events.on('update', onUpdate);
  g.once('destroy', () => {
    scene.events.off('update', onUpdate);
  });
  draw(0);
  return g;
}

/** 上下浮动的箭头，指示“往下拖” */
export function bounceArrow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = THEME.red,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(800);
  g.fillStyle(color, 1);
  g.fillTriangle(-26, -18, 26, -18, 0, 20);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(-26, -18, 26, -18, 0, 20);
  g.setPosition(x, y);
  scene.tweens.add({
    targets: g,
    y: y + 26,
    duration: 620,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return g;
}

/** 卡通小手，表示“可以拖我 / 点这里” */
export function drawHand(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s = 1,
): void {
  const skin = 0xf8dcbb;
  roundRect(g, x - 24 * s, y - 6 * s, 48 * s, 48 * s, 18 * s, skin, THEME.outline, 5 * s);
  roundRect(g, x - 17 * s, y - 40 * s, 14 * s, 40 * s, 7 * s, skin, THEME.outline, 5 * s);
  roundRect(g, x - 1 * s, y - 46 * s, 14 * s, 46 * s, 7 * s, skin, THEME.outline, 5 * s);
  roundRect(g, x + 15 * s, y - 36 * s, 13 * s, 36 * s, 6 * s, skin, THEME.outline, 5 * s);
  roundRect(g, x - 40 * s, y + 2 * s, 22 * s, 30 * s, 12 * s, skin, THEME.outline, 5 * s);
}

export function createHand(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s = 1,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(850);
  drawHand(g, 0, 0, s);
  g.setPosition(x, y);
  scene.tweens.add({
    targets: g,
    y: y + 18,
    duration: 560,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return g;
}
