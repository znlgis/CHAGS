import type Phaser from 'phaser';
import { CSS, THEME, circle, groundShadow, roundRect, shade, textStyle } from '@chags/phaser-kit';
import { MATCHUP, matchupScoreBar } from '@chags/templates/matchup';
import type { MatchupStageState } from '@chags/templates';
import type { MatchupHorse, MatchupLevel, MatchupRival } from '@chags/templates/schemas';

/**
 * 第 11 计的画面：一个赛场，不是战场。
 *
 * 三条跑道上站着三匹对手的马；我们三匹马站在等候区里，
 * 点一匹、再点一场，它就上场。三场排满了，按"开赛"。
 * 输掉的那一场，自己的马跑到半路停住 —— "这一局我们认了"，没有惩罚。
 *
 * 强弱用眼睛看：自己的马背上画几道纹（上等马 3 道、中等马 2 道、下等马 1 道），
 * 对手是清一色的灰马 —— "我的马都比他的差一点"这句话是画出来的，不是看数字看的。
 */

/** 跑道与等候区（与关卡脚本共用同一套口径） */
export const TRACK = {
  /** 终点线的左缘 */
  finishX: 660,
  /** 木牌画在对手上方多少 */
  signDy: -100,
  /** 跑道的右端 */
  laneEndX: 690,
} as const;

/** 一匹马：四条腿、身子、脖子与头、鬃毛和尾巴 */
function drawHorseBody(
  g: Phaser.GameObjects.Graphics,
  color: number,
  scale: number,
  mark: number,
  facing: 1 | -1,
): void {
  const s = scale;
  const bodyW = 132 * s;
  const bodyH = 62 * s;
  groundShadow(g, 0, 52 * s, 170 * s, 24 * s, 0.16);
  g.lineStyle(13 * s, shade(color, 0.8), 1);
  for (const dx of [-46, -18, 22, 48] as const) {
    g.lineBetween(dx * s, 18 * s, dx * s + (dx > 0 ? 4 : -4) * s, 54 * s);
  }
  roundRect(g, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 26 * s, color, THEME.outline, 5 * s);
  const neckX = facing * 54 * s;
  roundRect(g, neckX - 16 * s, -78 * s, 34 * s, 56 * s, 14 * s, color, THEME.outline, 5 * s);
  roundRect(g, neckX + facing * 16 * s - 20 * s, -104 * s, 46 * s, 32 * s, 12 * s, color, THEME.outline, 5 * s);
  circle(g, neckX + facing * 30 * s, -96 * s, 5 * s, THEME.ink, null, 0);
  g.fillStyle(THEME.ink, 0.85);
  g.fillTriangle(neckX - 18 * s, -76 * s, neckX + 2 * s, -96 * s, neckX + 8 * s, -70 * s);
  g.lineStyle(10 * s, THEME.ink, 0.85);
  g.beginPath();
  g.moveTo(-facing * 66 * s, -18 * s);
  g.lineTo(-facing * 96 * s, 6 * s);
  g.lineTo(-facing * 88 * s, 30 * s);
  g.strokePath();
  // 背上的纹：上等马 3 道、中等马 2 道、下等马 1 道（对手一律不画）
  g.lineStyle(7 * s, shade(color, 0.7), 1);
  for (let i = 0; i < mark; i += 1) {
    const x = (-12 + i * 20) * s;
    g.lineBetween(x, -22 * s, x, 6 * s);
  }
}

/** 一匹自己的马：站在等候区里（选中时头顶亮一盏灯，上场时脚下有一条跑道线） */
export function drawHorse(
  g: Phaser.GameObjects.Graphics,
  horse: MatchupHorse,
  flags: { selected: boolean; placed: boolean },
): void {
  const color = horse.rank === 'top' ? THEME.red : horse.rank === 'mid' ? THEME.gold : THEME.teal;
  const mark = horse.rank === 'top' ? 3 : horse.rank === 'mid' ? 2 : 1;
  drawHorseBody(g, color, 0.86, mark, 1);
  if (flags.placed) {
    g.lineStyle(7, shade(THEME.sand, 0.78), 1);
    g.lineBetween(-84, 54, 84, 54);
  }
  if (flags.selected) circle(g, 0, -140, 13, THEME.gold, THEME.outline, 5);
}

/**
 * 一匹对手的马：清一色的灰马，比我们的都壮。
 * 这里用 Graphics 的临时变换把"以原点为中心"的画法挪到对手的位置上 ——
 * 自己的马是画在容器里的（原点就是马身中心），两边的坐标系因此是一致的。
 */
function drawRivalHorse(g: Phaser.GameObjects.Graphics, rival: MatchupRival): void {
  g.save();
  g.translateCanvas(rival.x, rival.y);
  drawHorseBody(g, shade(THEME.stone, 0.98), 0.94, 0, -1);
  g.restore();
}

/** 木牌：这是第几场（文字另用 Text 画，Graphics 画不了字） */
function drawSign(g: Phaser.GameObjects.Graphics, rival: MatchupRival): void {
  roundRect(g, rival.x - 104, rival.y + TRACK.signDy, 208, 62, 18, THEME.card, THEME.outline, 5);
}

/** 木牌上的字：对手的称呼（来自内容 JSON，双语各自写） */
export function rivalSigns(
  scene: Phaser.Scene,
  level: MatchupLevel,
): Phaser.GameObjects.Text[] {
  return level.rivals.map((rival) =>
    scene.add
      .text(rival.x, rival.y + TRACK.signDy + 32, rival.label, textStyle(30, CSS.ink, true))
      .setOrigin(0.5)
      .setDepth(60),
  );
}

/** 赛场：草地、三条跑道、终点线、等候区 */
export function drawWorld(g: Phaser.GameObjects.Graphics, level: MatchupLevel): void {
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, 750, 1334 - 150);
  roundRect(g, 24, 250, 702, 700, 34, shade(THEME.leaf, 1.06), THEME.outline, 7);
  for (const rival of level.rivals) {
    g.lineStyle(6, THEME.card, 0.8);
    g.lineBetween(60, rival.y + 62, TRACK.laneEndX, rival.y + 62);
  }
  // 终点线：黑白格（马是往这边跑的）
  for (let i = 0; i < 14; i += 1) {
    g.fillStyle(i % 2 === 0 ? THEME.card : THEME.ink, 0.9);
    g.fillRect(TRACK.finishX, 270 + i * 46, 34, 46);
  }
  // 等候区：一块沙地
  roundRect(g, 40, 906, 670, 250, 32, shade(THEME.sand, 0.94), THEME.outline, 6);
  g.lineStyle(6, shade(THEME.sand, 0.8), 0.9);
  g.lineBetween(70, 1010, 680, 1010);

  for (const rival of level.rivals) {
    drawSign(g, rival);
    drawRivalHorse(g, rival);
  }
}

/** 每帧重画：输赢的圈 + 计分板（正在跑的马由模板自己挪） */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: MatchupStageState,
  level: MatchupLevel,
): void {
  for (const race of stage.results) {
    if (race === null) continue;
    const rival = level.rivals[race.index];
    if (!rival) continue;
    if (race.win) {
      g.lineStyle(9, THEME.gold, 0.85);
      g.strokeCircle(rival.x, rival.y, 78);
    } else {
      // 输的那一场：自己的马停在半路 —— 这一局我们认了
      g.lineStyle(8, shade(THEME.stone, 0.92), 0.95);
      g.lineBetween(rival.x - 92, rival.y + 76, rival.x + 92, rival.y + 76);
    }
  }
  matchupScoreBar(g, level, stage.wins);
}

/** 赢下整场：终点旗升起来，三条跑道一起亮 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  stage: MatchupStageState,
  level: MatchupLevel,
): void {
  void stage;
  g.fillStyle(THEME.gold, 0.14);
  g.fillRoundedRect(24, 250, 702, 700, 34);
  for (const rival of level.rivals) {
    g.lineStyle(10, THEME.gold, 0.5);
    g.strokeCircle(rival.x, rival.y, 88);
  }
}

/** 胜负之外的一句小提示（"这一局我们认了"）画在计分板下面 */
export function lostLine(
  scene: Phaser.Scene,
  text: string,
  y = MATCHUP.score.y + 92,
): Phaser.GameObjects.Text {
  return scene.add
    .text(375, y, text, textStyle(34, CSS.inkSoft, true))
    .setOrigin(0.5)
    .setDepth(85);
}

/**
 * 分幕插图：① 三场比赛，马都比对面差一点 ② 孙膑说：用最差的那匹，去对他最好的
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  roundRect(g, x - 10, y + h * 0.5, w + 20, h * 0.55, 24, shade(THEME.sand, 0.96), THEME.outline, 6);

  for (const [dy, mine] of [
    [0.3, THEME.red],
    [0.52, THEME.gold],
  ] as const) {
    const my = y + h * dy;
    g.lineStyle(5, THEME.card, 0.9);
    g.lineBetween(x + 20, my + 44, x + w - 20, my + 44);
    // 我们的马（小一点、颜色亮）
    const mx = x + w * 0.28;
    circle(g, mx, my, 30, mine, THEME.outline, 6);
    roundRect(g, mx + 30, my - 22, 44, 40, 14, mine, THEME.outline, 5);
    g.lineStyle(7, shade(mine, 0.7), 1);
    g.lineBetween(mx - 12, my - 18, mx - 12, my + 4);
    // 对面的马（大一截、灰色）—— "都差一点"是看得出来的
    const tx = x + w * 0.68;
    circle(g, tx, my + 4, 34, THEME.stone, THEME.outline, 6);
    roundRect(g, tx + 34, my - 20, 48, 44, 14, THEME.stone, THEME.outline, 5);
  }

  if (index === 0) return;
  // 第二幕：孙膑指着最左边那匹马 —— "下等马对他的上等马"
  g.lineStyle(18, THEME.teal, 1);
  g.lineBetween(x + w * 0.12, y + h * 0.8, x + w * 0.4, y + h * 0.64);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x + w * 0.12, y + h * 0.8, x + w * 0.4, y + h * 0.64);
  circle(g, x + w * 0.42, y + h * 0.63, 12, 0xf6d3ae, THEME.outline, 5);
}
