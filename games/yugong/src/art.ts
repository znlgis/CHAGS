import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';

const GROUND_Y = 900;
const MOUNTAIN_TOP = 850;

/** 挖山的人：一代比一代年轻一点，衣服颜色也换一换 */
const COAT = [THEME.red, 0xe08a3c, 0x4a8f6b];

export function drawDigger(
  g: Phaser.GameObjects.Graphics,
  x: number,
  scale: number,
  generation: number,
  timeMs: number,
  digging: boolean,
): void {
  const swing = digging ? Math.sin(timeMs / 110) * 0.7 : 0;
  const s = scale;

  groundShadow(g, x, GROUND_Y + 6, 90 * s, 20 * s, 0.16);

  // 腿
  g.lineStyle(16 * s, shade(COAT[(generation - 1) % COAT.length]!, 0.75), 1);
  g.beginPath();
  g.moveTo(x, GROUND_Y - 66 * s);
  g.lineTo(x - 16 * s, GROUND_Y);
  g.strokePath();
  g.beginPath();
  g.moveTo(x, GROUND_Y - 66 * s);
  g.lineTo(x + 16 * s, GROUND_Y);
  g.strokePath();

  // 身体
  roundRect(g, x - 30 * s, GROUND_Y - 166 * s, 60 * s, 104 * s, 24 * s, COAT[(generation - 1) % COAT.length]!, THEME.outline, 6);

  // 手臂 + 锄头
  const armAngle = -0.9 + swing;
  g.lineStyle(13 * s, COAT[(generation - 1) % COAT.length]!, 1);
  g.beginPath();
  g.moveTo(x + 20 * s, GROUND_Y - 150 * s);
  g.lineTo(x + 20 * s + Math.cos(armAngle) * 56 * s, GROUND_Y - 150 * s + Math.sin(armAngle) * 56 * s);
  g.strokePath();
  g.lineStyle(9 * s, THEME.woodDeep, 1);
  const hx = x + 20 * s + Math.cos(armAngle) * 66 * s;
  const hy = GROUND_Y - 150 * s + Math.sin(armAngle) * 66 * s;
  g.lineBetween(hx, hy, hx + 34 * s, hy + 30 * s);
  g.fillStyle(THEME.stone, 1);
  g.fillTriangle(hx + 24 * s, hy + 20 * s, hx + 54 * s, hy + 44 * s, hx + 30 * s, hy + 54 * s);
  g.lineStyle(4, THEME.outline, 1);
  g.strokeTriangle(hx + 24 * s, hy + 20 * s, hx + 54 * s, hy + 44 * s, hx + 30 * s, hy + 54 * s);

  // 头
  circle(g, x, GROUND_Y - 196 * s, 30 * s, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(0xdedede, 1);
  if (generation === 1) {
    // 愚公：白胡子
    g.fillTriangle(x - 18 * s, GROUND_Y - 178 * s, x + 18 * s, GROUND_Y - 178 * s, x, GROUND_Y - 132 * s);
  }
  g.fillStyle(THEME.ink, 1);
  g.fillCircle(x - 10 * s, GROUND_Y - 200 * s, 4 * s);
  g.fillCircle(x + 10 * s, GROUND_Y - 200 * s, 4 * s);
}

/** 智叟：抱臂摇头的老头 */
export function drawZhisou(
  g: Phaser.GameObjects.Graphics,
  x: number,
  timeMs: number,
): void {
  const shake = Math.sin(timeMs / 260) * 8;
  groundShadow(g, x, GROUND_Y + 6, 80, 18, 0.14);
  g.lineStyle(16, 0x6b6f8a, 1);
  g.beginPath();
  g.moveTo(x, GROUND_Y - 60);
  g.lineTo(x - 14, GROUND_Y);
  g.strokePath();
  g.beginPath();
  g.moveTo(x, GROUND_Y - 60);
  g.lineTo(x + 14, GROUND_Y);
  g.strokePath();
  roundRect(g, x - 30, GROUND_Y - 156, 60, 100, 24, 0x6b6f8a, THEME.outline, 6);
  circle(g, x + shake, GROUND_Y - 186, 30, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(0xdedede, 1);
  g.fillTriangle(x - 16 + shake, GROUND_Y - 176, x + 16 + shake, GROUND_Y - 176, x + shake, GROUND_Y - 134);
  g.fillStyle(THEME.ink, 1);
  g.fillCircle(x - 10 + shake, GROUND_Y - 190, 4);
  g.fillCircle(x + 10 + shake, GROUND_Y - 190, 4);
  // 抱着的双臂
  g.lineStyle(12, 0x6b6f8a, 1);
  g.lineBetween(x - 26, GROUND_Y - 128, x + 26, GROUND_Y - 128);
}

/** 分幕插图 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.sand, 1);
  g.fillRect(x, y + h - 140, w, 140);

  const shrink = index === 0 ? 1 : 1;
  for (const [ax, aw, ah] of [[x + 190, 230, 420], [x + 430, 250, 350]] as const) {
    g.fillStyle(THEME.sandDeep, 1);
    g.fillTriangle(ax - aw / 2, y + h - 140, ax + aw / 2, y + h - 140, ax, y + h - 140 - ah * shrink);
    g.lineStyle(6, THEME.outline, 1);
    g.strokeTriangle(ax - aw / 2, y + h - 140, ax + aw / 2, y + h - 140, ax, y + h - 140 - ah * shrink);
  }
  if (index === 1) {
    drawDigger(g, x + 110, 0.9, 1, 0, false);
    drawZhisou(g, x + w - 110, 0);
  } else {
    drawDigger(g, x + w - 130, 0.9, 1, 0, false);
  }
}

export interface YugongStage {
  width: number;
  height: number;
  eased: number;
}

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: YugongStage,
  timeMs: number,
  generation: number,
  zhisou: boolean,
  handover: boolean,
): void {
  g.fillStyle(THEME.sky, 1);
  g.fillRect(0, 150, stage.width, GROUND_Y - 150);

  // 山后面的天光：挖一点，就亮一点 —— 这就是"通往汉阴的路"
  g.fillStyle(0xfff3cf, 0.35 + stage.eased * 0.5);
  g.fillEllipse(stage.width / 2, MOUNTAIN_TOP - 40, 200 + stage.eased * 520, 260 + stage.eased * 180);

  // 两座大山：一担一担地变小
  const shrink = 1 - stage.eased * 0.88;
  const peaks: [number, number, number][] = [
    [250, 300, 580],
    [520, 250, 470],
  ];
  // 山快没了就干脆不画：剩两条几乎贴地的线反而像没收干净
  if (shrink > 0.06) for (const [cx, halfWidth, height] of peaks) {
    const h = Math.max(40, height * shrink);
    g.fillStyle(THEME.sandDeep, 1);
    g.fillTriangle(cx - halfWidth, GROUND_Y, cx + halfWidth, GROUND_Y, cx, GROUND_Y - h);
    g.lineStyle(7, THEME.outline, 1);
    g.strokeTriangle(cx - halfWidth, GROUND_Y, cx + halfWidth, GROUND_Y, cx, GROUND_Y - h);
    if (h > 200) {
      g.fillStyle(0xfffaf0, 0.9);
      g.fillTriangle(cx - 60, GROUND_Y - h + 110, cx + 60, GROUND_Y - h + 110, cx, GROUND_Y - h + 10);
    }
  }

  // 地面
  g.fillStyle(THEME.sand, 1);
  g.fillRect(0, GROUND_Y, stage.width, stage.height - GROUND_Y);

  // 一代一代的人，一个一个多起来 —— "子子孙孙无穷匮也"
  const spots = [210, 360, 500];
  for (let i = 0; i < generation; i += 1) {
    const x = spots[i] ?? 500;
    drawDigger(g, x, i === 0 ? 1 : 0.82, i + 1, timeMs, !handover);
  }

  if (zhisou) drawZhisou(g, 640, timeMs);

  // 交接提示：一只手，把锄头递给下一个人
  if (handover) {
    g.fillStyle(THEME.card, 0.95);
    g.fillCircle(stage.width / 2, GROUND_Y - 320, 54);
    g.lineStyle(7, THEME.outline, 1);
    g.strokeCircle(stage.width / 2, GROUND_Y - 320, 54);
    g.fillStyle(THEME.gold, 1);
    g.fillTriangle(
      stage.width / 2,
      GROUND_Y - 348,
      stage.width / 2 - 22,
      GROUND_Y - 306,
      stage.width / 2 + 22,
      GROUND_Y - 306,
    );
    g.fillStyle(THEME.woodDeep, 1);
    g.fillRoundedRect(stage.width / 2 - 8, GROUND_Y - 306, 16, 46, 8);
  }
}

/** 收尾：山没了，门前是一条通向远方的大路 */
export function drawFinale(g: Phaser.GameObjects.Graphics, stage: YugongStage): void {
  const cx = stage.width / 2;

  // 天光大亮
  g.fillStyle(0xffe9a8, 0.55);
  g.fillEllipse(cx, MOUNTAIN_TOP - 40, 640, 300);

  // 大路：近处宽、远处窄 —— 顺着它能看到汉阴
  g.fillStyle(0xf2e2b4, 1);
  g.beginPath();
  g.moveTo(cx - 40, GROUND_Y);
  g.lineTo(cx + 40, GROUND_Y);
  g.lineTo(cx + 300, stage.height);
  g.lineTo(cx - 300, stage.height);
  g.closePath();
  g.fillPath();
  g.lineStyle(8, THEME.outline, 0.3);
  g.strokePath();

  // 路中间的行道点，越近越大
  g.fillStyle(THEME.gold, 1);
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3;
    g.fillCircle(cx, GROUND_Y + 34 + t * (stage.height - GROUND_Y - 70), 8 + t * 12);
  }

  // 太行、王屋已经被背到很远的地方，只剩两个小小的影子
  g.fillStyle(THEME.sandDeep, 0.45);
  g.fillTriangle(cx - 300, GROUND_Y, cx - 190, GROUND_Y, cx - 245, GROUND_Y - 76);
  g.fillTriangle(cx + 185, GROUND_Y, cx + 305, GROUND_Y, cx + 245, GROUND_Y - 62);
}
