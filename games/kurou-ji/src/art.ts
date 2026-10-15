import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import type { SplitStageState } from '@chags/templates';
import {
  BOAT, CAMP, DESIGN_H, DESIGN_W, FAR_CAMP, LEFT_X, RIGHT_X, RIVER_LEFT, RIVER_RIGHT, RIVER_TOP,
  ROPE_Y, SKY_TOP, TOWER, WATCHER,
} from './layout';

/** 一张脸能看出的三种心思：平常 / 信了 / 发愁 */
type Mood = 'calm' | 'glad' | 'worry';

// ---------- 通用画笔 ----------

function sun(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.lineStyle(6, THEME.goldDeep, 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(
      x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8),
      x + Math.cos(a) * (r + 26), y + Math.sin(a) * (r + 26),
    );
  }
  circle(g, x, y, r, THEME.gold, THEME.goldDeep, 6);
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(THEME.card, 0.95);
  g.fillCircle(x, y, 30 * s);
  g.fillCircle(x + 38 * s, y - 14 * s, 38 * s);
  g.fillCircle(x + 78 * s, y + 2 * s, 26 * s);
  g.fillRoundedRect(x - 20 * s, y + 2 * s, 110 * s, 28 * s, 14 * s);
}

/** 远处的山：江对岸再远一点的地方 */
function hill(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, rx: number, ry: number): void {
  const pts: Array<[number, number]> = [];
  const steps = 20;
  for (let i = 0; i <= steps; i += 1) {
    const a = Math.PI * (i / steps);
    pts.push([cx - Math.cos(a) * rx, baseY - Math.sin(a) * ry]);
  }
  g.fillStyle(0xa8d6c0, 1);
  g.beginPath();
  pts.forEach(([px, py], index) => {
    if (index === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
}

/**
 * 一只粮袋：送出去的那一份，就是一袋一袋数得清的粮。
 * 船绳上悬着的、对岸堆着的、我们自己囤着的，都用它。
 */
export function drawSack(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  filled = true,
  s = 1,
): void {
  if (!filled) return;
  const cloth = 0xdcb46f;
  g.fillStyle(cloth, 1);
  g.fillEllipse(x, y + 14 * s, 52 * s, 60 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeEllipse(x, y + 14 * s, 52 * s, 60 * s);
  g.fillStyle(shade(cloth, 1.12), 1);
  g.fillEllipse(x - 6 * s, y + 6 * s, 24 * s, 30 * s);
  // 扎口的绳
  g.lineStyle(8 * s, THEME.woodDeep, 1);
  g.lineBetween(x - 17 * s, y - 12 * s, x + 17 * s, y - 12 * s);
  g.lineStyle(7 * s, THEME.woodDeep, 1);
  g.lineBetween(x - 6 * s, y - 18 * s, x + 4 * s, y - 28 * s);
  g.lineBetween(x + 6 * s, y - 18 * s, x + 16 * s, y - 26 * s);
  // 袋口露出来的谷粒
  g.fillStyle(THEME.gold, 1);
  for (const [dx, dy] of [[-10, -22], [2, -26], [14, -20]] as const) {
    g.fillCircle(x + dx * s, y + dy * s, 5 * s);
  }
}

/** 关卡的 drawThing 只要"某个份长什么样"，签名的 kind 这里用不上 */
export function drawThing(
  g: Phaser.GameObjects.Graphics,
  _kind: string,
  x: number,
  y: number,
  filled: boolean,
): void {
  drawSack(g, x, y, filled);
}

/** 一个人：喜怒都写在脸上 —— 自己人发愁、探子信或不信，孩子一眼看得出 */
function figure(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  robe: number,
  mood: Mood,
): void {
  groundShadow(g, x, y + 4 * s, 58 * s, 16 * s);
  g.lineStyle(11 * s, shade(robe, 0.72), 1);
  g.lineBetween(x - 9 * s, y - 34 * s, x - 11 * s, y);
  g.lineBetween(x + 9 * s, y - 34 * s, x + 11 * s, y);
  roundRect(g, x - 24 * s, y - 104 * s, 48 * s, 74 * s, 20 * s, robe, THEME.outline, 5 * s);
  circle(g, x, y - 122 * s, 24 * s, 0xf6d3ae, THEME.outline, 5 * s);
  g.fillStyle(0x3a2f26, 1);
  g.fillRoundedRect(x - 25 * s, y - 148 * s, 50 * s, 26 * s, 11 * s);
  // 手：信了就举手，发愁就抱头
  g.lineStyle(11 * s, robe, 1);
  if (mood === 'glad') {
    g.lineBetween(x - 24 * s, y - 92 * s, x - 50 * s, y - 138 * s);
    g.lineBetween(x + 24 * s, y - 92 * s, x + 50 * s, y - 138 * s);
  } else if (mood === 'worry') {
    g.lineBetween(x - 20 * s, y - 96 * s, x - 14 * s, y - 144 * s);
    g.lineBetween(x + 20 * s, y - 96 * s, x + 14 * s, y - 144 * s);
  } else {
    g.lineBetween(x - 24 * s, y - 88 * s, x - 28 * s, y - 44 * s);
    g.lineBetween(x + 24 * s, y - 88 * s, x + 28 * s, y - 44 * s);
  }
  // 眼睛与嘴
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 8 * s, y - 124 * s, 3.6 * s);
  g.fillCircle(x + 8 * s, y - 124 * s, 3.6 * s);
  g.lineStyle(4 * s, THEME.outline, 1);
  if (mood === 'glad') {
    g.beginPath();
    g.moveTo(x - 9 * s, y - 112 * s);
    g.lineTo(x, y - 103 * s);
    g.lineTo(x + 9 * s, y - 112 * s);
    g.strokePath();
  } else if (mood === 'worry') {
    g.lineBetween(x - 8 * s, y - 106 * s, x + 8 * s, y - 111 * s);
  } else {
    g.lineBetween(x - 8 * s, y - 108 * s, x + 8 * s, y - 108 * s);
  }
}

/** 对岸的探子：站在望楼上，举着望远镜盯着"送出去的"那一头 */
function scout(g: Phaser.GameObjects.Graphics, x: number, y: number, glad: boolean): void {
  figure(g, x, y, 0.92, 0x6f6a8f, glad ? 'glad' : 'calm');
  // 望远镜：一直朝着绳子右边那一头
  g.lineStyle(11, THEME.woodDeep, 1);
  g.lineBetween(x - 22, y - 136, x - 74, y - 148);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeCircle(x - 78, y - 149, 11);
  g.lineStyle(5, THEME.skyDeep, 1);
  g.strokeCircle(x - 78, y - 149, 7);
}

/** 心里的疑影：他还在打量送过来的那份东西，没点头 */
function doubtBubble(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  circle(g, x - 50, y + 62, 7, THEME.card, THEME.outline, 5);
  circle(g, x - 30, y + 40, 11, THEME.card, THEME.outline, 5);
  circle(g, x, y, 32, THEME.card, THEME.outline, 5);
  drawSack(g, x, y + 2, true, 0.34);
}

/** 望楼：几根木头架起来的高台，探子站上去才看得见对岸 */
function tower(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  groundShadow(g, x, y + 8, 168, 24);
  g.lineStyle(13, THEME.woodDeep, 1);
  g.lineBetween(x - 50, y, x - 30, y - 132);
  g.lineBetween(x + 50, y, x + 30, y - 132);
  g.lineBetween(x - 42, y - 62, x + 42, y - 62);
  // 台面
  roundRect(g, x - 66, y - 150, 132, 26, 9, THEME.wood, THEME.outline, 6);
  // 栏杆
  g.lineStyle(6, THEME.woodDeep, 1);
  g.lineBetween(x - 62, y - 150, x - 62, y - 186);
  g.lineBetween(x + 62, y - 150, x + 62, y - 186);
  g.lineBetween(x - 62, y - 168, x + 62, y - 168);
}

/** 我们自己营里的粮囤：留着的份就堆在这儿 */
function granary(g: Phaser.GameObjects.Graphics, x: number, y: number, sacks: number): void {
  groundShadow(g, x, y + 6, 150, 26);
  roundRect(g, x - 62, y - 96, 124, 100, { tl: 40, tr: 40, bl: 10, br: 10 }, THEME.wood, THEME.outline, 6);
  g.lineStyle(4, shade(THEME.wood, 0.8), 0.9);
  for (let i = 1; i < 3; i += 1) {
    g.lineBetween(x - 54, y - 96 + i * 30, x + 54, y - 96 + i * 30);
  }
  roundRect(g, x - 76, y - 128, 152, 34, { tl: 18, tr: 18, bl: 4, br: 4 }, THEME.woodDeep, THEME.outline, 5);
  // 囤边堆着的袋子：留得越多堆得越高（全送光了就是一个空囤）
  for (let i = 0; i < Math.min(sacks, 4); i += 1) {
    drawSack(g, x - 92, y - 6 - i * 34, true, 0.62);
  }
}

/** 对岸的营帐：旗帜朝我们这边飘 */
function tent(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, flag: number): void {
  groundShadow(g, x, y + 6 * s, 128 * s, 22 * s);
  g.fillStyle(0xf0dcb4, 1);
  g.beginPath();
  g.moveTo(x - 58 * s, y);
  g.lineTo(x, y - 96 * s);
  g.lineTo(x + 58 * s, y);
  g.closePath();
  g.fillPath();
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokePath();
  g.fillStyle(shade(0xf0dcb4, 0.88), 1);
  g.beginPath();
  g.moveTo(x, y - 96 * s);
  g.lineTo(x + 58 * s, y);
  g.lineTo(x + 14 * s, y);
  g.closePath();
  g.fillPath();
  g.lineStyle(6 * s, THEME.woodDeep, 1);
  g.lineBetween(x, y - 96 * s, x, y - 150 * s);
  g.fillStyle(flag, 1);
  g.beginPath();
  g.moveTo(x, y - 148 * s);
  g.lineTo(x + 54 * s, y - 130 * s);
  g.lineTo(x, y - 112 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(4 * s, THEME.outline, 1);
  g.strokePath();
}

/** 船绳两头的木杆：绳子（ROPE_Y）就绷在它们之间，杆子从岸上一直立到绳子上面 */
function mast(g: Phaser.GameObjects.Graphics, x: number, flag: number): void {
  const top = ROPE_Y - 180;
  const foot = ROPE_Y + 306;
  groundShadow(g, x, foot, 56, 16);
  roundRect(g, x - 11, top, 22, foot - top, 11, THEME.woodDeep, THEME.outline, 6);
  circle(g, x, top, 12, THEME.gold, THEME.outline, 5);
  g.fillStyle(flag, 1);
  g.beginPath();
  g.moveTo(x + 11, top + 36);
  g.lineTo(x + 86, top + 64);
  g.lineTo(x + 11, top + 96);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, THEME.outline, 1);
  g.strokePath();
}

/** 渡船：送出去的那几袋，一船一船运过去 */
function ferry(g: Phaser.GameObjects.Graphics, x: number, y: number, sacks: number): void {
  g.fillStyle(THEME.wood, 1);
  g.beginPath();
  g.moveTo(x - 76, y - 18);
  g.lineTo(x + 76, y - 18);
  g.lineTo(x + 54, y + 30);
  g.lineTo(x - 54, y + 30);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, THEME.outline, 1);
  g.strokePath();
  g.lineStyle(6, THEME.woodDeep, 1);
  g.lineBetween(x - 62, y - 4, x + 62, y - 4);
  for (let i = 0; i < Math.min(sacks, 3); i += 1) {
    drawSack(g, x - 34 + i * 34, y - 44, true, 0.6);
  }
}

// ---------- 整屏世界 ----------

/**
 * 一屏：我们自己的营在左岸，对岸曹营的望楼在右岸，大江从中间穿过去。
 * 船绳横在最上面，八袋粮挂在绳上 —— 木牌一动，两边的份就变了。
 */
export function drawWorld(g: Phaser.GameObjects.Graphics, state: SplitStageState): void {
  const W = DESIGN_W;
  const H = DESIGN_H;
  const kept = state.counts.kept ?? 0;
  const given = state.counts.given ?? 0;

  // 天：他信了，天光就亮一点
  g.fillStyle(state.mood === 'happy' ? 0xdff2ff : THEME.sky, 1);
  g.fillRect(0, SKY_TOP, W, RIVER_TOP - SKY_TOP);
  sun(g, 636, 228, 40);
  cloud(g, 150, 246, 0.9);
  cloud(g, 452, 318, 0.62);

  // 天边的远山：对岸再过去一点的地方
  hill(g, 168, RIVER_TOP + 6, 200, 150);
  hill(g, 604, RIVER_TOP + 6, 176, 122);

  // 两岸：左边是我们的营，右边是对岸
  g.fillStyle(THEME.sand, 1);
  g.fillRect(-40, RIVER_TOP, RIVER_LEFT + 40, H - RIVER_TOP + 40);
  g.fillRect(RIVER_RIGHT, RIVER_TOP, W - RIVER_RIGHT + 40, H - RIVER_TOP + 40);

  // 大江：一江水从中间流下去
  wavyBand(g, RIVER_LEFT, RIVER_TOP + 4, RIVER_RIGHT - RIVER_LEFT, H - RIVER_TOP + 40, THEME.water, 1, 9, 3.2, 26);
  g.fillStyle(THEME.waterDeep, 0.45);
  for (let i = 0; i < 4; i += 1) {
    g.fillRect(RIVER_LEFT + 16, RIVER_TOP + 130 + i * 160, RIVER_RIGHT - RIVER_LEFT - 32, 8);
  }
  g.lineStyle(5, THEME.card, 0.7);
  g.lineBetween(RIVER_LEFT + 6, RIVER_TOP + 60, RIVER_LEFT + 40, RIVER_TOP + 60);
  g.lineBetween(RIVER_RIGHT - 40, RIVER_TOP + 220, RIVER_RIGHT - 6, RIVER_TOP + 220);

  // 岸上的草皮：压在江水两边，江才有"岸"
  roundRect(g, -40, RIVER_TOP - 20, RIVER_LEFT + 56, 48, 22, THEME.leaf, THEME.outline, 6);
  roundRect(g, RIVER_RIGHT - 16, RIVER_TOP - 20, W - RIVER_RIGHT + 56, 48, 22, THEME.leaf, THEME.outline, 6);

  // 绳子两头的木杆
  mast(g, LEFT_X, THEME.red);
  mast(g, RIGHT_X, THEME.tealDeep);

  // 左岸：我们自己的营（地上的影子先铺，人才站得住）
  g.fillStyle(THEME.outline, 0.1);
  g.fillEllipse(CAMP.x, CAMP.y + 106, 280, 44);
  granary(g, CAMP.x, CAMP.y, kept);
  figure(g, 58, 1104, 0.98, THEME.teal, state.greedy ? 'worry' : 'calm');
  figure(g, 272, 1116, 0.88, THEME.red, state.greedy ? 'worry' : 'calm');

  // 右岸：对岸曹营的望楼与营帐
  tower(g, TOWER.x, TOWER.y);
  scout(g, WATCHER.x, WATCHER.y, state.mood === 'happy');
  // 他还不太信的时候，头顶飘着一个"还在打量那份东西"的念头
  if (state.mood !== 'happy') doubtBubble(g, WATCHER.x + 190, WATCHER.y - 198);
  tent(g, FAR_CAMP.x, FAR_CAMP.y, 1, THEME.tealDeep);
  tent(g, FAR_CAMP.x - 96, FAR_CAMP.y + 44, 0.72, THEME.redDeep);
  figure(g, 706, 1160, 0.8, 0x6f6a8f, state.mood === 'happy' ? 'glad' : 'calm');

  // 江上的渡船：送出去的份，就是从这儿过去的
  if (given > 0) ferry(g, BOAT.x, BOAT.y, given);

  // 全送光了：自己人的粮囤见底，孩子一眼看得出"代价"
  if (state.greedy) {
    g.fillStyle(THEME.outline, 0.16);
    g.fillRoundedRect(CAMP.x - 62, CAMP.y - 96, 124, 100, 18);
  }
}

/**
 * 收尾：把分好的样子摆出来 —— 送出去的那几袋落在对岸，自己这边还剩几袋。
 * 一份送得够多，探子终于点头；一份留在营里，自己人才不会饿肚子。
 */
export function drawFinale(g: Phaser.GameObjects.Graphics, state: SplitStageState): void {
  const kept = state.counts.kept ?? 0;
  const given = state.counts.given ?? 0;

  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(RIGHT_X - 40, RIVER_TOP + 220, 260);

  // 送出去的那一份：一袋一袋堆在对岸，谁都看得见
  for (let i = 0; i < given; i += 1) {
    drawSack(g, 520 + (i % 3) * 60, 1178 - Math.floor(i / 3) * 60, true, 0.92);
  }
  // 留在营里的那一份
  for (let i = 0; i < kept; i += 1) {
    drawSack(g, 74 + (i % 2) * 52, 1198 - Math.floor(i / 2) * 58, true, 0.92);
  }
  // 船已经靠岸，探子举手
  ferry(g, BOAT.x, BOAT.y, Math.min(given, 3));
  scout(g, WATCHER.x, WATCHER.y, true);
}

// ---------- 分幕插图 ----------

function beatBackdrop(g: Phaser.GameObjects.Graphics, rect: { x: number; y: number; w: number; h: number }): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(THEME.water, 1);
  g.fillRect(x + w * 0.38, y + h * 0.62, w * 0.24, h * 0.4);
  g.fillStyle(THEME.sand, 1);
  g.fillRect(x - 10, y + h * 0.66, w * 0.4, h * 0.36);
  g.fillRect(x + w * 0.6, y + h * 0.66, w * 0.42, h * 0.36);
  g.fillStyle(THEME.leaf, 1);
  g.fillRoundedRect(x - 10, y + h * 0.62, w * 0.42, 26, 12);
  g.fillRoundedRect(x + w * 0.58, y + h * 0.62, w * 0.44, 26, 12);
}

/** ① 江两边：他凭什么信 ② 先送一份过去：探子看见了 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  beatBackdrop(g, rect);

  if (index === 0) {
    // 我们这边：粮囤堆着，人却愁着 —— 对面不信
    granary(g, x + w * 0.22, y + h * 0.68, 3);
    figure(g, x + w * 0.1, y + h * 0.76, 0.86, THEME.teal, 'worry');
    g.lineStyle(6, THEME.woodDeep, 1);
    g.lineBetween(x + w * 0.4, y + h * 0.24, x + w * 0.6, y + h * 0.24);
    // 对岸：探子举着望远镜，头顶一个大问号
    tower(g, x + w * 0.82, y + h * 0.7);
    scout(g, x + w * 0.82, y + h * 0.5, false);
    g.lineStyle(12, THEME.redDeep, 1);
    g.beginPath();
    g.moveTo(x + w * 0.62, y + h * 0.2);
    g.lineTo(x + w * 0.66, y + h * 0.34);
    g.strokePath();
    g.fillStyle(THEME.redDeep, 1);
    g.fillCircle(x + w * 0.62, y + h * 0.42, 11);
    return;
  }

  // ② 船装着粮袋过江，探子在望楼上看见了
  g.fillStyle(THEME.gold, 0.2);
  g.fillCircle(x + w * 0.66, y + h * 0.5, 96);
  tower(g, x + w * 0.84, y + h * 0.7);
  scout(g, x + w * 0.84, y + h * 0.5, false);
  ferry(g, x + w * 0.5, y + h * 0.78, 3);
  drawSack(g, x + w * 0.7, y + h * 0.72, true, 1.1);
  drawSack(g, x + w * 0.78, y + h * 0.78, true, 1.1);
  figure(g, x + w * 0.14, y + h * 0.78, 0.9, 0x6f6a8f, 'calm');
}
