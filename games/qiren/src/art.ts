import type Phaser from 'phaser';
import { THEME, circle, drawHand, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN, PLACE } from '@chags/templates';

/**
 * 杞人忧天：一间夜里的屋子，头顶一片会散的黑云。
 *
 * 画面上只有两样东西：
 * - **担忧**：深色的云泡泡，里面一张发愁的小脸（空槽的样子）
 * - **想明白**：淡淡的、会发光的小画面（归位之后的样子）
 *
 * 泡泡破了，天就亮一点 —— "想通了"是看得见的。
 */

type Rect = { x: number; y: number; w: number; h: number };

/** 夜色：模板给的底是浅色的，深蓝只用在屋子、云团与泡泡上 */
const NIGHT_DEEP = 0x1d2440;
const NIGHT = 0x2f3861;
const NIGHT_SOFT = 0x4c5a91;
const WINDOW = 0x16203c;
/** 光：灯、星光，以及想明白之后剩下的那点暖 */
const LIGHT = 0xffe9a8;
const SKIN = 0xf6d3ae;
const HAIR = 0x2b2337;
const ROBE_WORRIED = 0x8b9bd8;
const ROBE_KIND = 0xe2a24f;
const CLOUD = 0x3c4470;
const SOIL = 0x9a6a3c;

/** 泡泡半径：与关卡数据里的 slot.radius 一致 */
const BUBBLE = 70;

/** 四个泡泡在天空区的位置：与 entries/qiren.json 的 slots 一一对应 */
const SLOT_SPOTS: Record<string, { x: number; y: number }> = {
  'slot-sky': { x: 200, y: 245 },
  'slot-ground': { x: 550, y: 245 },
  'slot-suns': { x: 200, y: 530 },
  'slot-stars': { x: 550, y: 530 },
};

// ---------- 小零件：整个典故里反复出现的那几样东西 ----------

/** 四角星：比五角星圆润，贴在夜空上不扎眼 */
function star4(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (Math.PI * i) / 4;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

/** 太阳：一圆八芒 */
function sun(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.lineStyle(5, THEME.goldDeep, 0.95);
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    g.lineBetween(
      cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4),
      cx + Math.cos(a) * (r + 13), cy + Math.sin(a) * (r + 13),
    );
  }
  circle(g, cx, cy, r, THEME.gold, THEME.outline, 5);
}

/** 月牙：画好圆月，再用背景色咬掉一口（和盘古那边同一招） */
function crescent(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  body: number,
  bite: number,
): void {
  circle(g, cx, cy, r, body, THEME.outline, 5);
  g.fillStyle(bite, 1);
  g.fillCircle(cx + r * 0.52, cy - r * 0.3, r * 0.84);
}

/** 一团气：三团叠在一起的云气，边上带一点旋 */
function airPuff(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
  for (const [dx, dy, r] of [[-16, 5, 14], [1, -6, 17], [17, 6, 13]] as const) {
    circle(g, cx + dx * s, cy + dy * s, r * s, THEME.sky, THEME.skyDeep, 5);
  }
  g.lineStyle(5, THEME.skyDeep, 0.85);
  g.beginPath();
  g.arc(cx + 2 * s, cy + 3 * s, 27 * s, -0.45, 1.15, false);
  g.strokePath();
}

/** 一块土：带几粒小石子和一株刚冒头的小苗 */
function soilClod(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
  g.fillStyle(SOIL, 1);
  g.lineStyle(5, THEME.outline, 1);
  g.beginPath();
  g.moveTo(cx - 26 * s, cy + 6 * s);
  g.lineTo(cx - 16 * s, cy - 14 * s);
  g.lineTo(cx + 8 * s, cy - 17 * s);
  g.lineTo(cx + 26 * s, cy - 4 * s);
  g.lineTo(cx + 18 * s, cy + 16 * s);
  g.lineTo(cx - 12 * s, cy + 18 * s);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(THEME.woodDeep, 1);
  g.fillCircle(cx - 6 * s, cy + 2 * s, 5 * s);
  g.fillCircle(cx + 10 * s, cy + 6 * s, 4 * s);
  g.lineStyle(5, THEME.leaf, 1);
  g.beginPath();
  g.moveTo(cx + 2 * s, cy - 16 * s);
  g.lineTo(cx + 4 * s, cy - 30 * s);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + 4 * s, cy - 24 * s);
  g.lineTo(cx + 16 * s, cy - 30 * s);
  g.strokePath();
}

/** 小石子：流星掉下来之后，手心里剩下的那一点 */
function pebble(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.fillStyle(THEME.stone, 1);
  g.lineStyle(5, THEME.outline, 1);
  g.beginPath();
  g.moveTo(cx - r, cy + r * 0.3);
  g.lineTo(cx - r * 0.5, cy - r * 0.85);
  g.lineTo(cx + r * 0.6, cy - r * 0.9);
  g.lineTo(cx + r, cy + r * 0.2);
  g.lineTo(cx + r * 0.3, cy + r);
  g.lineTo(cx - r * 0.6, cy + r * 0.9);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(THEME.stoneDeep, 1);
  g.fillCircle(cx - r * 0.2, cy - r * 0.1, r * 0.22);
  g.fillCircle(cx + r * 0.35, cy + r * 0.35, r * 0.16);
}

// ---------- 两张小脸 ----------

/** 发愁的脸：眼睛瞪得大，眉毛拧着，嘴角往下（ink 用在深色泡泡上是浅色） */
function worriedFace(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  ink: number,
): void {
  circle(g, cx - r * 0.38, cy, r * 0.3, THEME.card, ink, 4);
  circle(g, cx + r * 0.38, cy, r * 0.3, THEME.card, ink, 4);
  g.fillStyle(ink, 1);
  g.fillCircle(cx - r * 0.38, cy - r * 0.06, r * 0.13);
  g.fillCircle(cx + r * 0.38, cy - r * 0.06, r * 0.13);
  g.lineStyle(5, ink, 1);
  g.lineBetween(cx - r * 0.76, cy - r * 0.54, cx - r * 0.16, cy - r * 0.34);
  g.lineBetween(cx + r * 0.76, cy - r * 0.54, cx + r * 0.16, cy - r * 0.34);
  g.beginPath();
  g.arc(cx, cy + r * 0.72, r * 0.24, Math.PI * 1.15, Math.PI * 1.85, false);
  g.strokePath();
}

/** 想明白之后的脸：眼睛弯弯，嘴在笑 */
function happyFace(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  ink: number,
): void {
  g.lineStyle(5, ink, 1);
  g.beginPath();
  g.arc(cx - r * 0.38, cy - r * 0.06, r * 0.26, Math.PI * 1.1, Math.PI * 1.9, false);
  g.strokePath();
  g.beginPath();
  g.arc(cx + r * 0.38, cy - r * 0.06, r * 0.26, Math.PI * 1.1, Math.PI * 1.9, false);
  g.strokePath();
  g.beginPath();
  g.arc(cx, cy + r * 0.24, r * 0.4, Math.PI * 0.2, Math.PI * 0.8, false);
  g.strokePath();
}

// ---------- 空槽：担忧泡泡；归位：想明白 ----------

/** 泡泡里坠着的那件"担心"：天、地、日月、星星 */
function drawWorry(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
): void {
  switch (kind) {
    case 'sky':
      g.fillStyle(NIGHT_SOFT, 1);
      g.lineStyle(5, LIGHT, 0.9);
      g.beginPath();
      g.arc(x, y + 13, 27, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    case 'ground':
      roundRect(g, x - 28, y - 7, 56, 23, 9, SOIL, LIGHT, 5);
      break;
    case 'suns':
      sun(g, x, y, 21);
      break;
    case 'stars':
      star4(g, x, y, 26, LIGHT, 0.95);
      break;
    default:
      break;
  }
}

/** 空槽 = 一个担忧泡泡：深色云团 + 发愁的小脸 + 他担心的那件事 */
function drawWorryBubble(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
): void {
  g.fillStyle(CLOUD, 0.2);
  g.fillCircle(x, y, BUBBLE + 22);
  for (const [dx, dy, r] of [
    [-60, -40, 30], [0, -62, 30], [60, -40, 30], [70, 20, 28], [-70, 20, 28], [0, 60, 28],
  ] as const) {
    circle(g, x + dx, y + dy, r, CLOUD, THEME.outline, 5);
  }
  circle(g, x, y, BUBBLE, NIGHT, THEME.outline, 7);
  worriedFace(g, x, y - 26, 30, LIGHT);
  drawWorry(g, kind, x, y + 40);
}

/** 归位：泡泡化成淡淡的光，里面是他"看一眼就明白"的那个小画面 */
function drawSettledBubble(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
): void {
  g.fillStyle(LIGHT, 0.2);
  g.fillCircle(x, y, BUBBLE + 26);
  circle(g, x, y, BUBBLE, THEME.card, THEME.goldDeep, 6, 0.94);
  drawProof(g, kind, x, y);
}

/** 看一眼就明白：气托着鸟和云 / 土地稳稳托着一间屋 / 日月轮着来 / 流星只是小石子 */
function drawProof(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
): void {
  switch (kind) {
    case 'sky': {
      g.fillStyle(THEME.sky, 1);
      g.fillCircle(x, y + 8, 58);
      g.lineStyle(5, THEME.skyDeep, 0.85);
      g.strokeCircle(x, y + 8, 58);
      g.lineStyle(5, THEME.outline, 1);
      g.beginPath();
      g.moveTo(x - 34, y - 18);
      g.lineTo(x - 22, y - 29);
      g.lineTo(x - 10, y - 18);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + 4, y - 26);
      g.lineTo(x + 15, y - 37);
      g.lineTo(x + 26, y - 26);
      g.strokePath();
      airPuff(g, x - 8, y + 30, 0.85);
      break;
    }
    case 'ground': {
      g.fillStyle(THEME.sand, 1);
      g.fillEllipse(x, y + 40, 132, 48);
      g.lineStyle(5, THEME.outline, 1);
      g.strokeEllipse(x, y + 40, 132, 48);
      // 一间稳稳站着的小屋
      g.fillStyle(THEME.red, 1);
      g.fillTriangle(x - 34, y - 2, x + 34, y - 2, x, y - 36);
      g.lineStyle(5, THEME.outline, 1);
      g.strokeTriangle(x - 34, y - 2, x + 34, y - 2, x, y - 36);
      roundRect(g, x - 26, y - 2, 52, 42, 8, THEME.card, THEME.outline, 5);
      roundRect(g, x - 9, y + 18, 18, 22, 6, THEME.wood, THEME.outline, 4);
      break;
    }
    case 'suns': {
      sun(g, x - 26, y - 12, 19);
      crescent(g, x + 28, y + 12, 21, THEME.sky, THEME.card);
      // 落下去，第二天还会升上来
      g.lineStyle(5, THEME.goldDeep, 0.9);
      g.beginPath();
      g.arc(x, y + 6, 48, Math.PI * 0.2, Math.PI * 0.8, false);
      g.strokePath();
      g.fillStyle(THEME.goldDeep, 1);
      g.fillTriangle(x - 54, y + 24, x - 40, y + 24, x - 47, y + 38);
      break;
    }
    case 'stars': {
      // 星星掉下来，只是一块小石子，落在手心里
      drawHand(g, x - 24, y + 34, 0.62);
      pebble(g, x - 24, y + 24, 13);
      star4(g, x + 36, y - 34, 12, THEME.gold, 1);
      star4(g, x + 54, y - 4, 8, THEME.gold, 0.9);
      g.lineStyle(5, THEME.goldDeep, 0.75);
      for (let i = 0; i < 3; i += 1) {
        g.lineBetween(x + 30 - i * 13, y - 22 + i * 17, x + 22 - i * 13, y - 10 + i * 17);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * 空槽与归位后的样子。
 * 空槽是"他还没想明白"——一团深色的云；归位之后泡泡化成光，只剩安安静静的那个道理。
 */
export function drawPiece(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
  filled: boolean,
): void {
  if (filled) drawSettledBubble(g, kind, x, y);
  else drawWorryBubble(g, kind, x, y);
}

// ---------- 托盘里的四个"想明白" ----------

/** 托盘里的光球：一团气 / 一块土 / 日月 / 一颗小石子（画在容器原点） */
export function drawOrb(g: Phaser.GameObjects.Graphics, kind: string): void {
  g.fillStyle(THEME.gold, 0.3);
  g.fillCircle(0, 0, 58);
  circle(g, 0, 0, 44, THEME.card, THEME.goldDeep, 6, 0.96);

  switch (kind) {
    case 'air':
      airPuff(g, 0, 0, 1);
      break;
    case 'soil':
      soilClod(g, 0, 4, 1);
      break;
    case 'sunmoon':
      sun(g, -15, -7, 16);
      crescent(g, 15, 9, 19, THEME.sky, THEME.card);
      break;
    case 'meteor':
      // 一小截尾巴 + 一颗小石子
      g.fillStyle(THEME.gold, 0.6);
      g.fillTriangle(30, -30, 8, 6, 34, -4);
      pebble(g, -6, 8, 16);
      break;
    default:
      break;
  }
}

// ---------- 收尾：黑云散了，星光安静 ----------

/**
 * 四个泡泡都破了：整片天沉下来，黑云被推开，只剩安静的星光
 * —— 那个担心了一夜的人，终于可以睡了。
 */
export function drawFinale(g: Phaser.GameObjects.Graphics, placedIds: string[]): void {
  roundRect(
    g,
    -40,
    PLACE.skyTop - 40,
    DESIGN.width + 80,
    PLACE.skyBottom - PLACE.skyTop + 40,
    44,
    NIGHT_DEEP,
    null,
    0,
    0.9,
  );

  // 四个泡泡的位置上，留着一圈淡淡的光
  for (const id of placedIds) {
    const spot = SLOT_SPOTS[id];
    if (!spot) continue;
    g.fillStyle(LIGHT, 0.16);
    g.fillCircle(spot.x, spot.y, BUBBLE + 30);
    g.lineStyle(6, LIGHT, 0.45);
    g.strokeCircle(spot.x, spot.y, BUBBLE + 18);
  }

  // 黑云散开：一团团被推开，越远越淡
  for (const [i, spot] of Object.values(SLOT_SPOTS).entries()) {
    const dir = i % 2 === 0 ? -1 : 1;
    for (let k = 0; k < 3; k += 1) {
      g.fillStyle(CLOUD, 0.34 - k * 0.1);
      g.fillCircle(spot.x + dir * (110 + k * 76), spot.y - (70 + k * 56), 32 - k * 7);
    }
  }

  // 星光：安静地亮着，不再往下掉
  for (let i = 0; i < 46; i += 1) {
    const px = 40 + ((i * 173) % (DESIGN.width - 80));
    const py = PLACE.skyTop + 24 + ((i * 271) % (PLACE.skyBottom - PLACE.skyTop - 48));
    star4(g, px, py, 5 + (i % 3) * 3, LIGHT, 0.5 + (i % 4) * 0.12);
  }
  crescent(g, 150, 210, 40, LIGHT, NIGHT_DEEP);
}

// ---------- 分幕插图：夜里的那间小屋 ----------

/** 夜里的屋子：两幕共用，第二幕灯亮一些 */
function nightRoom(g: Phaser.GameObjects.Graphics, rect: Rect, brighter: boolean): void {
  const { x, y, w, h } = rect;
  roundRect(g, x, y, w, h, 34, brighter ? NIGHT_SOFT : NIGHT, THEME.outline, 7);

  // 地板
  const floorY = y + h - 250;
  g.fillStyle(NIGHT_DEEP, 1);
  g.fillRect(x + 7, floorY, w - 14, h - 252);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(x + 7, floorY, x + w - 7, floorY);

  // 窗：月亮和星星在外面
  const wx = x + w - 214;
  const wy = y + 74;
  roundRect(g, wx, wy, 168, 156, 26, WINDOW, THEME.outline, 6);
  crescent(g, wx + 52, wy + 52, 24, LIGHT, WINDOW);
  star4(g, wx + 116, wy + 42, 9, LIGHT, 1);
  star4(g, wx + 134, wy + 98, 7, LIGHT, 0.9);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(wx + 84, wy + 4, wx + 84, wy + 152);
  g.lineBetween(wx + 4, wy + 78, wx + 164, wy + 78);

  // 屋角的油灯
  const lx = x + 96;
  const ly = y + 120;
  g.fillStyle(LIGHT, brighter ? 0.3 : 0.2);
  g.fillCircle(lx, ly - 26, brighter ? 96 : 72);
  g.fillStyle(THEME.goldDeep, 1);
  g.fillEllipse(lx, ly + 28, 58, 20);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(lx, ly + 28, 58, 20);
  g.fillStyle(LIGHT, 1);
  g.fillEllipse(lx, ly - 6, 20, 36);
  g.lineStyle(5, THEME.goldDeep, 1);
  g.strokeEllipse(lx, ly - 6, 20, 36);
}

/** 桌上那碗没动过的饭："吃不下"是看得见的 */
function untouchedMeal(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  roundRect(g, x, y, 154, 20, 10, THEME.wood, THEME.outline, 5);
  roundRect(g, x + 14, y + 20, 18, 54, 8, THEME.woodDeep, THEME.outline, 5);
  roundRect(g, x + 122, y + 20, 18, 54, 8, THEME.woodDeep, THEME.outline, 5);
  // 一碗冒尖的饭，一口没动
  g.fillStyle(THEME.card, 1);
  g.fillEllipse(x + 78, y - 6, 62, 44);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeEllipse(x + 78, y - 6, 62, 44);
  roundRect(g, x + 46, y - 14, 64, 18, 9, THEME.card, THEME.outline, 5);
}

function arm(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}

/** 脑袋：上半个圆是头发，加一个发髻 */
function head(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  worried: boolean,
): void {
  circle(g, cx, cy, r, SKIN, THEME.outline, 6);
  g.fillStyle(HAIR, 1);
  g.beginPath();
  g.arc(cx, cy, r, Math.PI, Math.PI * 2, false);
  g.closePath();
  g.fillPath();
  circle(g, cx, cy - r - 10, r * 0.32, HAIR, THEME.outline, 5);
  if (worried) {
    worriedFace(g, cx, cy + r * 0.1, r * 0.7, THEME.outline);
    // 一滴冷汗
    g.fillStyle(THEME.sky, 1);
    g.fillCircle(cx + r * 0.9, cy - r * 0.16, 7);
    g.fillTriangle(cx + r * 0.9 - 6, cy - r * 0.2, cx + r * 0.9 + 6, cy - r * 0.2, cx + r * 0.9, cy - r * 0.42);
  } else {
    happyFace(g, cx, cy + r * 0.1, r * 0.7, THEME.outline);
  }
}

/** 杞人：缩着肩坐在地上；worried = 双手捧着腮 */
function sittingMan(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  worried: boolean,
): void {
  const robe = ROBE_WORRIED;
  const headY = baseY - 190;
  groundShadow(g, cx, baseY + 10, 178, 42, 0.3);
  // 盘着的腿
  roundRect(g, cx - 64, baseY - 60, 128, 60, 28, shade(robe, 0.76), THEME.outline, 6);
  // 身子
  roundRect(g, cx - 50, baseY - 158, 100, 106, 36, robe, THEME.outline, 6);
  // 手臂
  g.lineStyle(20, robe, 1);
  if (worried) {
    arm(g, cx - 42, baseY - 118, cx - 40, headY + 16);
    arm(g, cx + 42, baseY - 118, cx + 40, headY + 16);
  } else {
    arm(g, cx - 42, baseY - 118, cx - 34, baseY - 66);
    arm(g, cx + 42, baseY - 118, cx + 30, baseY - 74);
  }
  circle(g, cx - 40, worried ? headY + 12 : baseY - 62, 15, SKIN, THEME.outline, 5);
  circle(g, cx + 40, worried ? headY + 12 : baseY - 70, 15, SKIN, THEME.outline, 5);
  head(g, cx, headY, 44, worried);
}

/** 晓之者：站着，一只手往天上指，另一只手托着"一块土" */
function standingMan(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
): void {
  const robe = ROBE_KIND;
  groundShadow(g, cx, baseY + 8, 152, 36, 0.3);
  roundRect(g, cx - 38, baseY - 92, 30, 96, 15, shade(robe, 0.76), THEME.outline, 6);
  roundRect(g, cx + 8, baseY - 92, 30, 96, 15, shade(robe, 0.76), THEME.outline, 6);
  roundRect(g, cx - 46, baseY - 250, 92, 168, 34, robe, THEME.outline, 6);
  g.lineStyle(20, robe, 1);
  // 一只手往天上指
  arm(g, cx - 34, baseY - 214, cx - 88, baseY - 296);
  circle(g, cx - 94, baseY - 306, 15, SKIN, THEME.outline, 5);
  // 一只手托着土
  arm(g, cx + 34, baseY - 214, cx + 82, baseY - 178);
  circle(g, cx + 90, baseY - 176, 15, SKIN, THEME.outline, 5);
  head(g, cx, baseY - 290, 44, false);
}

/** 头顶的黑云：整团的，或者正在散开的 */
function worryCloud(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  withFace: boolean,
): void {
  for (const [dx, dy, rr] of [
    [-r * 0.92, -r * 0.38, r * 0.5],
    [0, -r * 0.66, r * 0.52],
    [r * 0.92, -r * 0.38, r * 0.5],
    [r * 0.7, r * 0.42, r * 0.44],
    [-r * 0.7, r * 0.42, r * 0.44],
  ] as const) {
    circle(g, cx + dx, cy + dy, rr, CLOUD, THEME.outline, 5);
  }
  circle(g, cx, cy, r, NIGHT, THEME.outline, 6);
  if (withFace) worriedFace(g, cx, cy - r * 0.08, r * 0.42, LIGHT);
}

/**
 * 两幕分幕插图：
 * 第一幕 —— 夜里的屋子，他缩在地上发愁，头顶压着一团黑云，桌上的饭一口没动；
 * 第二幕 —— 好心的晓之者来了，指着天说"那是积起来的气"，另一只手上托着一块土。
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: Rect,
): void {
  const { x, y, w, h } = rect;
  const headY = y + h - 56 - 190;
  nightRoom(g, rect, index === 1);
  untouchedMeal(g, x + 40, y + h - 216);

  if (index === 0) {
    sittingMan(g, x + w * 0.42, y + h - 56, true);
    worryCloud(g, x + w * 0.42, headY - 150, 64, true);
    return;
  }

  // 第二幕：他听着，黑云松了一点，正一团团飘走
  sittingMan(g, x + w * 0.4, y + h - 56, false);
  worryCloud(g, x + w * 0.4 - 132, headY - 148, 44, false);
  for (const [dx, dy, r] of [[132, -28, 26], [186, -66, 20], [226, 6, 15]] as const) {
    g.fillStyle(CLOUD, 0.5);
    g.fillCircle(x + w * 0.4 - 132 + dx, headY - 148 + dy, r);
  }

  const kindX = x + w * 0.72;
  standingMan(g, kindX, y + h - 56);
  // 指天的那只手上面，是一团气
  airPuff(g, kindX - 94, y + h - 56 - 366, 0.9);
  // 另一只手上托着一块土
  soilClod(g, kindX + 90, y + h - 56 - 206, 0.62);
}
