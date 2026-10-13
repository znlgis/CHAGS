import type Phaser from 'phaser';
import { THEME, roundRect, shade } from '@chags/phaser-kit';
import type { TapStageMetrics } from '@chags/templates';
import { drawPangu } from '../art';

/**
 * 盘古撑天：原本写在 grow 模板里，泛化成 tap 之后搬到这里 ——
 * 模板只管"连点推进"，画面归游戏自己。
 *
 * 天日高一丈，地日厚一丈，盘古日长一丈：缝隙 = 缓动进度。
 */
const SKY_TOP = 150;
const CENTER_Y = 640;
const EARTH_BOTTOM = 1334;
const START_GAP = 40;
const END_GAP = 700;

export const holdStage = {
  width: 750,
  height: 1334,
};

export function drawHoldStage(g: Phaser.GameObjects.Graphics, stage: TapStageMetrics): void {
  const gap = START_GAP + (END_GAP - START_GAP) * stage.eased;
  const skyBottom = CENTER_Y - gap / 2;
  const earthTop = CENTER_Y + gap / 2;

  // 撑开之前中间是虚空
  g.fillStyle(THEME.ink, 1);
  g.fillRect(0, SKY_TOP, stage.width, stage.height - SKY_TOP);

  // 天：越高越亮
  const skyH = Math.max(20, skyBottom - SKY_TOP);
  roundRect(
    g,
    -40,
    SKY_TOP - 40,
    stage.width + 80,
    skyH + 40,
    44,
    shade(THEME.sky, 1 - stage.eased * 0.06),
    THEME.outline,
    7,
  );
  if (skyH > 130) {
    g.fillStyle(0xffffff, 0.85);
    for (const [cx, ratio, cs] of [[150, 0.55, 1], [560, 0.35, 0.75], [330, 0.8, 0.6]] as const) {
      const y = SKY_TOP + skyH * ratio;
      g.fillCircle(cx, y, 30 * cs);
      g.fillCircle(cx + 38 * cs, y - 12 * cs, 38 * cs);
      g.fillCircle(cx + 78 * cs, y, 26 * cs);
    }
  }

  // 地：越沉越厚，山峦成形
  const earthH = Math.max(20, EARTH_BOTTOM - earthTop);
  roundRect(
    g,
    -40,
    earthTop,
    stage.width + 80,
    earthH + 60,
    { tl: 60, tr: 60, bl: 0, br: 0 },
    THEME.sand,
    THEME.outline,
    7,
  );
  if (earthH > 120) {
    g.fillStyle(THEME.sandDeep, 1);
    g.fillTriangle(120, earthTop + 90, 250, earthTop + 90, 185, earthTop + 10);
    g.fillTriangle(430, earthTop + 90, 600, earthTop + 90, 515, earthTop + 25);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(120, earthTop + 90, 250, earthTop + 90, 185, earthTop + 10);
    g.strokeTriangle(430, earthTop + 90, 600, earthTop + 90, 515, earthTop + 25);
  }

  drawPangu(g, stage.width / 2, skyBottom, earthTop);
}

/** 天成了：日月星辰；地成了：山川成形 */
export function drawHoldFinale(g: Phaser.GameObjects.Graphics, stage: TapStageMetrics): void {
  const skyBottom = CENTER_Y - (START_GAP + (END_GAP - START_GAP) * stage.eased) / 2;
  const visible = skyBottom - SKY_TOP;

  g.fillStyle(THEME.gold, 1);
  g.fillCircle(150, skyBottom - 90, 42);
  g.fillStyle(THEME.card, 1);
  g.fillCircle(600, skyBottom - 110, 34);
  g.fillStyle(THEME.card, 0.9);
  for (const [sx, sy] of [[300, 60], [420, 100], [240, 140], [520, 50], [660, 150]] as const) {
    g.fillCircle(sx, skyBottom - visible * 0.25 + sy * 0.3, 5);
  }
}
