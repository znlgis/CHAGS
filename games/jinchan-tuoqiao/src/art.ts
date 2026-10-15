import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import { SWAP, swapProgressBar } from '@chags/templates';
import type { SwapStageState } from '@chags/templates';
import type { SwapLevel } from '@chags/templates/schemas';
import {
  GATE, GROUND_TOP, PILE_BOTTOM, PILE_TOP, POST_RADIUS, SPARE_RADIUS, TENTS, TOWER, WALL_BOTTOM,
  WALL_TOP,
} from './layout';

const W = DESIGN.width;
const H = DESIGN.height;

/** 夜色：天上暗、地上更暗；火把与院门是唯二的暖色（孩子一眼看出"哪儿还亮着"） */
const NIGHT = 0x263353;
const NIGHT_DEEP = 0x1b243d;
const HILL = 0x334064;
const STONE = 0x5c6076;
const STONE_LIGHT = 0x767b92;
const PLANK = 0x8a6a45;
const PLANK_DEEP = 0x6a4f31;
const STRAW = 0xd8b569;
const STRAW_DEEP = 0xb08c45;
const ARMOR = 0x4f6f8f;
const ARMOR_LIGHT = 0x6d90ae;
const SKIN = 0xf8dcbb;
const MOON = 0xfdf3dc;

/** 一个人 / 一个稻草人的高度与落脚点：脚在 y 上，头顶大约在 y - FIG_H */
const FIG_H = 156;
/** 兵士与稻草人站的位置（脚底）：在墙下的走道上 */
export function figureFeet(postY: number): number {
  return postY + POST_RADIUS - 2;
}

// ---------------- 小零件 ----------------

/** 星星：夜里那几颗，位置写死（不随机 —— 每次进来长得一样） */
const STARS = [
  { x: 80, y: 210 }, { x: 205, y: 178 }, { x: 330, y: 236 }, { x: 470, y: 190 },
  { x: 560, y: 268 }, { x: 128, y: 300 }, { x: 690, y: 200 }, { x: 402, y: 320 },
] as const;

/** 那个东西本身（鼓 / 旗 / 火把 / 矛 / 号角）—— **兵士与稻草人拿的是同一份**，孩子靠它配对 */
function drawKindProp(
  g: Phaser.GameObjects.Graphics,
  x: number,
  feet: number,
  kind: string,
  dim = 1,
): void {
  const hand = feet - FIG_H * 0.52;
  // 手里那一握：从身子连到家伙上（不然它像是浮在旁边，配不上对）
  g.lineStyle(9, THEME.outline, 0.5);
  g.lineBetween(x + 14, hand + 2, x + 32, hand + 2);
  if (kind === 'drum') {
    // 鼓：挂在腰边，两根鼓槌
    const dx = x + 30;
    roundRect(g, dx - 34, hand - 4, 74, 46, 14, shade(THEME.red, dim), THEME.outline, 6);
    g.fillStyle(shade(THEME.paper, dim), 1);
    g.fillEllipse(dx + 3, hand + 19, 78, 40);
    g.lineStyle(4, THEME.outline, 1);
    g.strokeEllipse(dx + 3, hand + 19, 78, 40);
    g.lineStyle(7, PLANK_DEEP, 1);
    g.lineBetween(dx - 6, hand - 26, dx + 12, hand + 2);
    g.lineBetween(dx + 22, hand - 26, dx + 12, hand + 2);
    return;
  }
  if (kind === 'flag') {
    // 旗：一根旗杆，旗面朝右展开
    g.lineStyle(9, PLANK_DEEP, 1);
    g.lineBetween(x + 34, feet, x + 34, feet - FIG_H * 1.26);
    g.fillStyle(shade(THEME.red, dim), 1);
    g.fillTriangle(x + 34, feet - FIG_H * 1.24, x + 92, feet - FIG_H * 1.1, x + 34, feet - FIG_H * 0.96);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(x + 34, feet - FIG_H * 1.24, x + 92, feet - FIG_H * 1.1, x + 34, feet - FIG_H * 0.96);
    return;
  }
  if (kind === 'torch') {
    // 火把：一根短棍、一团火
    g.lineStyle(10, PLANK_DEEP, 1);
    g.lineBetween(x + 34, hand + 10, x + 38, hand - 52);
    g.fillStyle(shade(THEME.gold, 1), 0.95);
    g.fillTriangle(x + 16, hand - 40, x + 60, hand - 40, x + 38, hand - 104);
    g.fillStyle(shade(THEME.red, 1), 0.95);
    g.fillTriangle(x + 26, hand - 42, x + 50, hand - 42, x + 39, hand - 80);
    g.fillStyle(THEME.gold, 1);
    g.fillCircle(x + 38, hand - 34, 13);
    return;
  }
  if (kind === 'spear') {
    // 矛：竖着的一根长杆，矛尖朝上
    g.lineStyle(9, PLANK_DEEP, 1);
    g.lineBetween(x + 34, feet, x + 34, feet - FIG_H * 1.32);
    g.fillStyle(shade(THEME.stone, 1), 1);
    g.fillTriangle(x + 34, feet - FIG_H * 1.52, x + 18, feet - FIG_H * 1.26, x + 50, feet - FIG_H * 1.26);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(
      x + 34, feet - FIG_H * 1.52, x + 18, feet - FIG_H * 1.26, x + 50, feet - FIG_H * 1.26,
    );
    return;
  }
  // horn：号角（斜着举在嘴边）
  g.fillStyle(shade(THEME.gold, dim), 1);
  g.fillTriangle(x + 26, hand - 6, x + 26, hand + 26, x + 96, hand - 34);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x + 26, hand - 6, x + 26, hand + 26, x + 96, hand - 34);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x + 30, hand + 10, 7);
}

/**
 * 站在岗位上的**人**：一身甲。squash 是落位/抬头时的那一下（0.8..1.1）。
 */
function drawSoldier(
  g: Phaser.GameObjects.Graphics,
  x: number,
  feet: number,
  kind: string,
  squash = 1,
  alarmed = false,
): void {
  const h = FIG_H * squash;
  const top = feet - h;
  groundShadow(g, x, feet + 4, 108, 26, 0.22);
  // 身子：一件甲
  roundRect(g, x - 38, top + h * 0.3, 76, h * 0.72, 22, ARMOR, THEME.outline, 6);
  g.fillStyle(ARMOR_LIGHT, 1);
  g.fillEllipse(x, top + h * 0.56, 70, 44);
  // 腰带
  g.lineStyle(8, THEME.goldDeep, 1);
  g.lineBetween(x - 32, top + h * 0.68, x + 32, top + h * 0.68);
  // 头与头盔
  circle(g, x, top + h * 0.18, 27, SKIN, THEME.outline, 6);
  g.fillStyle(shade(ARMOR, 1.25), 1);
  g.fillTriangle(x - 32, top + h * 0.12, x + 32, top + h * 0.12, x, top - h * 0.06);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 32, top + h * 0.12, x + 32, top + h * 0.12, x, top - h * 0.06);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 8, top + h * 0.18, alarmed ? 5 : 3.5);
  g.fillCircle(x + 8, top + h * 0.18, alarmed ? 5 : 3.5);
  // 手里的家伙画在**身子之上**：鼓、号角、旗、矛都看得见（配对全靠它）
  drawKindProp(g, x, feet, kind);
  if (!alarmed) return;
  // 被看见了：头顶一个小小的"!"（不是惩罚，是"这里露馅了"）
  roundRect(g, x - 6, top - 62, 12, 34, 6, THEME.red, THEME.outline, 4);
  circle(g, x, top - 16, 7, THEME.red, THEME.outline, 4);
}

/**
 * **稻草人替身**：同一个岗位、同一件家伙（鼓 / 旗 / 火把 / 矛 / 号角），
 * 但身子是草扎的、姿势是直的 —— 远看像，近看才知道是替身。
 */
function drawDummy(
  g: Phaser.GameObjects.Graphics,
  x: number,
  feet: number,
  kind: string,
  squash = 1,
  lift = 0,
): void {
  const h = FIG_H * squash;
  const top = feet - h - lift;
  const base = feet - lift;
  if (lift <= 0) groundShadow(g, x, feet + 4, 104, 24, 0.2);
  // 身子：一捆稻草（横着扎两道绳）
  roundRect(g, x - 36, top + h * 0.3, 72, h * 0.72, 18, STRAW, THEME.outline, 6);
  g.lineStyle(7, STRAW_DEEP, 1);
  g.lineBetween(x - 34, top + h * 0.5, x + 34, top + h * 0.5);
  g.lineBetween(x - 32, top + h * 0.68, x + 32, top + h * 0.68);
  g.fillStyle(shade(STRAW, 1.12), 1);
  g.fillEllipse(x, top + h * 0.56, 66, 40);
  // 头：一颗草球，扣一顶草帽
  circle(g, x, top + h * 0.18, 26, shade(STRAW, 1.05), THEME.outline, 6);
  g.fillStyle(STRAW_DEEP, 1);
  g.fillTriangle(x - 36, top + h * 0.1, x + 36, top + h * 0.1, x, top - h * 0.02);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x - 36, top + h * 0.1, x + 36, top + h * 0.1, x, top - h * 0.02);
  // 眼睛：两颗扣子（稻草人没有表情）
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 8, top + h * 0.18, 4);
  g.fillCircle(x + 8, top + h * 0.18, 4);
  // 手里的家伙画在**身子之上**：跟真人拿的是同一份（孩子靠它配对）
  drawKindProp(g, x, base, kind);
}

/** 一丛草（营外的地上）：夜里的草是暗绿的，三个圆鼓包就是一小丛，不抢人 */
function drawGrassTuft(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  g.fillStyle(shade(THEME.leaf, 0.42), 1);
  g.fillEllipse(x - 17 * s, y - 8 * s, 36 * s, 24 * s);
  g.fillEllipse(x + 17 * s, y - 9 * s, 40 * s, 26 * s);
  g.fillEllipse(x, y - 16 * s, 54 * s, 32 * s);
  g.lineStyle(4, THEME.outline, 0.55);
  g.strokeEllipse(x, y - 16 * s, 54 * s, 32 * s);
}

/** 一块石头（夜里也要看得见：亮一点） */
function drawStone(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(shade(STONE, 1.05), 1);
  g.fillEllipse(x, y, r * 2, r * 1.3);
  g.lineStyle(5, THEME.outline, 0.7);
  g.strokeEllipse(x, y, r * 2, r * 1.3);
  g.fillStyle(STONE_LIGHT, 0.7);
  g.fillEllipse(x - r * 0.24, y - r * 0.24, r * 0.9, r * 0.5);
}

/** 一顶帐幕（营里）：夜里黑着，说明人早走了 */
function drawTent(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle(shade(SKIN, 0.6), 1);
  g.fillTriangle(x - w / 2, y + h / 2, x + w / 2, y + h / 2, x, y - h / 2);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - w / 2, y + h / 2, x + w / 2, y + h / 2, x, y - h / 2);
  // 帐前的两根支杆与地面线：一眼看出是帐篷，不是山
  g.lineStyle(6, PLANK_DEEP, 1);
  g.lineBetween(x - w / 2, y + h / 2, x - w / 2 - 10, y + h / 2 - 24);
  g.lineBetween(x + w / 2, y + h / 2, x + w / 2 + 10, y + h / 2 - 24);
  g.lineStyle(5, THEME.outline, 0.7);
  g.lineBetween(x - w / 2 - 12, y + h / 2 + 4, x + w / 2 + 12, y + h / 2 + 4);
  g.fillStyle(NIGHT_DEEP, 0.85);
  g.fillTriangle(x - w * 0.16, y + h / 2, x + w * 0.16, y + h / 2, x, y + h * 0.06);
}

/** 岗楼：检查者站在上头，抬头的那一下（lookUp）他会直起身来 */
function drawTower(g: Phaser.GameObjects.Graphics, lookUp: number): void {
  const { x, y } = TOWER;
  // 四根柱子
  g.lineStyle(12, PLANK_DEEP, 1);
  g.lineBetween(x - 54, y + 150, x - 44, y - 40);
  g.lineBetween(x + 54, y + 150, x + 44, y - 40);
  g.lineStyle(8, PLANK, 1);
  for (let i = 0; i < 3; i += 1) {
    g.lineBetween(x - 52 + i * 2, y + 120 - i * 52, x + 52 - i * 2, y + 120 - i * 52);
  }
  // 楼板与顶
  roundRect(g, x - 62, y - 44, 124, 18, 8, PLANK, THEME.outline, 5);
  g.fillStyle(shade(THEME.red, 0.9), 1);
  g.fillTriangle(x - 74, y - 44, x + 74, y - 44, x, y - 116);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 74, y - 44, x + 74, y - 44, x, y - 116);
  // 检查者：抬起头来的时候身子直一点、头抬一点
  const rise = 6 + lookUp * 16;
  circle(g, x - 12, y - 62 + rise, 20, SKIN, THEME.outline, 5);
  roundRect(g, x - 32, y - 44, 40, 34, 12, ARMOR, THEME.outline, 5);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(x - 18, y - 64 + rise, 3.5);
  g.fillCircle(x - 4, y - 64 + rise, 3.5);
}

/**
 * 营门：两根木柱挑着灯笼、门楣上插一面小旗，门里那一段是**亮着的路**。
 * 夜里它是画面里唯一的暖色 —— 孩子一眼就知道"该往这儿走"。
 */
function drawGate(g: Phaser.GameObjects.Graphics, open: boolean): void {
  const { x, y, radius } = GATE;
  const half = radius * 0.82;
  const openW = radius * 0.58;
  groundShadow(g, x, y + 44, half * 3.4, 46, 0.26);
  // 两根门柱（比门楣还高的木柱）
  for (const side of [-1, 1]) {
    const px = x + side * half;
    roundRect(g, px - 14, y - 96, 28, 152, 10, PLANK_DEEP, THEME.outline, 5);
  }
  // 门洞：开着是一段"外面的路"，关着是一扇门板
  g.fillStyle(open ? shade(THEME.sandDeep, 0.94) : PLANK, 1);
  g.fillRect(x - openW, y - 76, openW * 2, 130);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRect(x - openW, y - 76, openW * 2, 130);
  if (open) {
    // 路上的几级台阶：越往外越亮
    g.fillStyle(shade(THEME.sand, 0.94), 1);
    for (let i = 0; i < 3; i += 1) {
      g.fillRect(x - openW + 6 + i * 4, y + 8 + i * 24, openW * 2 - 12 - i * 8, 16);
    }
  } else {
    g.lineStyle(7, THEME.goldDeep, 1);
    g.lineBetween(x - openW + 6, y - 30, x + openW - 6, y - 18);
    g.lineBetween(x - openW + 6, y + 22, x + openW - 6, y + 34);
  }
  // 门楣与门楼上的小旗
  roundRect(g, x - half - 22, y - 118, (half + 22) * 2, 32, 10, PLANK, THEME.outline, 5);
  g.lineStyle(8, PLANK_DEEP, 1);
  g.lineBetween(x, y - 118, x, y - 178);
  g.fillStyle(shade(THEME.red, 0.98), 1);
  g.fillTriangle(x, y - 176, x + 48, y - 146, x, y - 118);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(x, y - 176, x + 48, y - 146, x, y - 118);
  // 两盏灯笼：夜里指着出口
  for (const side of [-1, 1]) {
    const px = x + side * half;
    g.fillStyle(THEME.gold, 0.22);
    g.fillCircle(px, y - 104, 34);
    circle(g, px, y - 104, 15, THEME.gold, THEME.outline, 4);
    g.fillStyle(THEME.paper, 0.9);
    g.fillCircle(px - 4, y - 108, 5);
  }
}

// ---------------- 景 ----------------

export function drawWorld(g: Phaser.GameObjects.Graphics, level: SwapLevel): void {
  // 夜色（标题条下面开始）
  g.fillStyle(NIGHT, 1);
  g.fillRect(0, WALL_TOP - 40, W, H - WALL_TOP + 40);
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  // 远山
  g.fillStyle(HILL, 1);
  g.fillTriangle(-60, WALL_TOP - 20, 260, WALL_TOP - 20, 60, WALL_TOP - 210);
  g.fillTriangle(220, WALL_TOP - 20, 560, WALL_TOP - 20, 392, WALL_TOP - 260);
  g.fillTriangle(500, WALL_TOP - 20, 830, WALL_TOP - 20, 660, WALL_TOP - 190);
  // 星星与月亮
  for (const star of STARS) {
    g.fillStyle(MOON, 0.75);
    g.fillCircle(star.x, star.y, 3.2);
  }
  circle(g, 108, 236, 40, MOON, THEME.outline, 4);
  g.fillStyle(shade(NIGHT, 1.35), 1);
  g.fillCircle(126, 226, 30);
  // 帐幕
  for (const tent of TENTS) drawTent(g, tent.x, tent.y, tent.w, tent.h);
  // 营墙：垛口 + 墙身 + 墙下的走道
  g.fillStyle(STONE, 1);
  g.fillRect(0, WALL_TOP, W, WALL_BOTTOM - WALL_TOP);
  g.fillStyle(STONE_LIGHT, 0.65);
  for (let x = 0; x < W; x += 54) {
    g.fillRect(x + 8, WALL_TOP - 26, 38, 30);
  }
  g.lineStyle(4, THEME.outline, 0.5);
  for (let y = WALL_TOP + 34; y < WALL_BOTTOM; y += 34) g.lineBetween(0, y, W, y);
  // 走道（人 / 稻草人站的那一条木板路）
  g.fillStyle(PLANK, 1);
  g.fillRect(0, WALL_BOTTOM - 46, W, 52);
  g.lineStyle(5, PLANK_DEEP, 1);
  for (let x = 0; x < W; x += 76) g.lineBetween(x, WALL_BOTTOM - 46, x, WALL_BOTTOM + 6);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(0, WALL_BOTTOM + 6, W, WALL_BOTTOM + 6);

  // 营外的地面：草堆与院门都在这一片
  wavyBand(g, -20, GROUND_TOP - 26, W + 40, 60, NIGHT_DEEP, 1, 10, 3);
  // 地上那几笔：草丛、石头（不然一大片深色太空）
  drawGrassTuft(g, 96, 902, 0.9);
  drawGrassTuft(g, 250, 866);
  drawGrassTuft(g, 470, 890, 1.1);
  drawGrassTuft(g, 690, 858, 0.8);
  drawStone(g, 180, 820, 20);
  drawStone(g, 560, 806, 24);
  drawStone(g, 40, 966, 18);
  // 草堆：一块垫在地上的席子，里面散着几根稻草
  g.fillStyle(shade(STRAW_DEEP, 0.42), 0.4);
  g.fillRoundedRect(16, PILE_TOP, W - 32, PILE_BOTTOM - PILE_TOP, 40);
  g.lineStyle(4, shade(STRAW, 0.7), 0.5);
  g.strokeRoundedRect(16, PILE_TOP, W - 32, PILE_BOTTOM - PILE_TOP, 40);
  g.lineStyle(5, shade(STRAW, 0.8), 0.5);
  for (let i = 0; i < 12; i += 1) {
    const sx = 46 + i * 58;
    const sy = PILE_TOP + 22 + (i % 3) * 40;
    g.lineBetween(sx, sy + 16, sx + 26, sy - 6);
  }

  // 五个岗位脚下的木桩（画的是"这里该站着人"的位置）
  for (const post of level.posts) {
    g.fillStyle(PLANK_DEEP, 1);
    g.fillEllipse(post.x, figureFeet(post.y) + 6, 118, 30);
    g.lineStyle(5, THEME.outline, 0.6);
    g.strokeEllipse(post.x, figureFeet(post.y) + 6, 118, 30);
  }

  drawTower(g, 0);
  drawGate(g, true);
}

// ---------------- 每帧 ----------------

export function drawStage(
  g: Phaser.GameObjects.Graphics,
  state: SwapStageState,
  level: SwapLevel,
): void {
  // 检查者抬头了没有（灯柱由模板画，这里只让他直起身）
  const lookUp =
    state.lastPeekAtMs >= 0 && state.elapsedMs - state.lastPeekAtMs <= 1100 ? 1 : 0;
  drawTower(g, lookUp);

  // 手上的替身在哪儿（拿着它的时候，草堆里那一个就不画了）
  const held = state.carrying;
  // 每个替身此刻站在哪个位置上（画草堆要用：站上去的那几个不在草堆里了）
  const standing = new Set(Object.values(state.covers));

  // 一排岗位：换好了是稻草人，没换好是还站在那儿的兵
  for (const post of level.posts) {
    const swapped = state.swapped.includes(post.id);
    const caught = state.caught.includes(post.id);
    const feet = figureFeet(post.y);
    const justPlaced = state.lastPlacePost === post.id;
    const since = state.elapsedMs - state.lastPlaceAtMs;
    const squash = justPlaced && since >= 0 && since <= SWAP.placeMs
      ? 0.82 + 0.18 * Math.min(1, since / SWAP.placeMs)
      : 1;
    if (swapped) drawDummy(g, post.x, feet, post.kind, squash);
    else drawSoldier(g, post.x, feet, post.kind, 1, caught);
  }

  // 草堆：还躺着的替身
  for (const spare of level.spares) {
    if (spare.id === held || standing.has(spare.id)) continue;
    drawDummy(g, spare.x, spare.y + SPARE_RADIUS - 6, spare.kind, 0.96);
  }

  // 手上的那一个：提到指尖上面，稍微斜一点（"拿着呢"）
  const carried = level.spares.find((spare) => spare.id === held);
  if (carried !== undefined && state.carryingAt !== null) {
    const at = state.carryingAt;
    drawDummy(g, at.x, at.y + 34, carried.kind, 0.9, 26);
    // 脚下一圈"拿稳了"的光（不是画在腰上 —— 那看着像个箍）
    g.lineStyle(6, THEME.gold, 0.8);
    g.strokeEllipse(at.x, at.y + 38, 104, 26);
    g.lineStyle(4, THEME.gold, 0.4);
    g.strokeEllipse(at.x, at.y + 38, 132, 34);
  }

  // 换好了几个 / 一共几个：进度槽在左下角（院门在右下角，不打架）
  swapProgressBar(g, level, state.swappedCount);

  // 还没换好的位置：脚下有一点"还在等"的暗影（一眼看出还剩几个）
  const left = level.posts.filter((post) => !state.swapped.includes(post.id));
  if (left.length > 0 && !state.done) {
    const breathe = 0.5 + 0.5 * Math.sin(state.elapsedMs / 300);
    for (const post of left) {
      g.lineStyle(6, THEME.gold, 0.18 + 0.22 * breathe);
      g.strokeEllipse(post.x, figureFeet(post.y) + 10, 122 + 8 * breathe, 32);
    }
  }
}

/** 收尾：一排都是稻草人，门口那条路上有人走远了 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  state: SwapStageState,
  level: SwapLevel,
): void {
  g.fillStyle(THEME.gold, 0.14);
  g.fillEllipse(GATE.x, GATE.y, 620, 420);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(GATE.x, GATE.y, 180);
  // 一排稻草人还在（这一关的"壳"）
  for (const post of level.posts) {
    drawDummy(g, post.x, figureFeet(post.y), post.kind, 1);
  }
  // 走远的那一个：出了院门，越走越远（只剩背影）
  const since = Math.max(0, state.elapsedMs - Math.max(0, state.lastPeekAtMs));
  const walk = Math.min(1, since / 1800);
  const x = GATE.x + 70 + walk * 64;
  const y = GATE.y + 40;
  groundShadow(g, x, y + 8, 92, 24, 0.2);
  roundRect(g, x - 30, y - FIG_H * 0.62, 60, FIG_H * 0.66, 18, shade(ARMOR, 0.7), THEME.outline, 6);
  circle(g, x, y - FIG_H * 0.68, 24, shade(SKIN, 0.8), THEME.outline, 6);
}

// ---------------- 分幕插图 ----------------

/**
 * 分幕插图：① 鼓声响了一整夜，营里一个人影也不动
 * ② 天快亮时才看清：岗上站的全是稻草人，人早走了
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(index === 0 ? NIGHT_DEEP : NIGHT, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  for (const star of STARS) {
    g.fillStyle(MOON, 0.7);
    g.fillCircle(x + (star.x / W) * w, y + (star.y / 420) * h * 0.5, 3);
  }
  circle(g, x + w * 0.16, y + h * 0.16, 30, MOON, THEME.outline, 4);
  g.fillStyle(index === 0 ? NIGHT_DEEP : NIGHT, 1);
  g.fillCircle(x + w * 0.19, y + h * 0.14, 22);

  // 远处的那座营（对方的营）：几顶小帐幕
  g.fillStyle(HILL, 1);
  g.fillTriangle(x - 20, y + h * 0.46, x + w + 20, y + h * 0.46, x + w * 0.5, y + h * 0.2);
  g.fillStyle(shade(HILL, 0.8), 1);
  g.fillTriangle(x - 20, y + h * 0.46, x + w + 20, y + h * 0.46, x + w * 0.5, y + h * 0.3);
  for (let i = 0; i < 3; i += 1) {
    drawTent(g, x + w * (0.16 + i * 0.3), y + h * 0.4, 54, 40);
  }

  // 我方的营墙与那一排岗位
  const wallY = y + h * 0.62;
  g.fillStyle(STONE, 1);
  g.fillRect(x, wallY, w, h * 0.2);
  g.fillStyle(STONE_LIGHT, 0.6);
  for (let i = 0; i < 7; i += 1) g.fillRect(x + 14 + i * (w / 7), wallY - 18, 34, 22);
  g.fillStyle(PLANK, 1);
  g.fillRect(x, wallY + h * 0.2, w, h * 0.05);

  // 一排岗位上站着谁：第①幕是兵，第②幕全是稻草人
  const feet = wallY + h * 0.2;
  const kinds = ['drum', 'flag', 'torch', 'spear', 'horn'];
  kinds.forEach((kind, i) => {
    const px = x + w * (0.12 + i * 0.19);
    if (index === 0) drawSoldier(g, px, feet, kind, 0.72);
    else drawDummy(g, px, feet, kind, 0.72);
  });

  if (index === 0) {
    // 鼓声（一圈一圈散开的声浪）—— 人不动，鼓在响
    const drumX = x + w * 0.12;
    for (let i = 0; i < 3; i += 1) {
      g.lineStyle(5, THEME.gold, 0.4 - i * 0.1);
      g.strokeCircle(drumX, feet - 60, 70 + i * 40);
    }
  } else {
    // 天边有点亮了：人已经走出去很远
    g.fillStyle(THEME.gold, 0.18);
    g.fillTriangle(x + w, y + h * 0.5, x + w, y + h * 0.6, x + w * 0.72, y + h * 0.55);
  }
}
