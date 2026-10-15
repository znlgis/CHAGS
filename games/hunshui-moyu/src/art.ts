import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade } from '@chags/phaser-kit';
import { DESIGN } from '@chags/templates';
import type { StirStageState, StirWindowLevel } from '@chags/templates';
import {
  BANK_TOP, CREEL, MURK_GAUGE, POLE, ROCK, STIR_SPOT, WATER_TOP, WILLOW,
} from './layout';

/**
 * 淝水边的那口塘：**摸鱼不是捉鱼，鱼一条也不会受伤**。
 *
 * 水本来是清的：点水面搅浑（浑度涨、封顶 100），浑水里鱼才慢下来、才摸得到；
 * 水一清，摸到一半的那条鱼摆尾滑走（只是重来）。岸上有一只竹篓 ——
 * 摸到的鱼放进篓里，水塘里还剩几条，一眼看得清。
 */

const SKY = 0xbfe3ef;
const BANK = 0xf0dcae;
const BANK_DEEP = 0xd9bd85;
const WATER_CLEAR = 0x59abda;
const WATER_CLEAR_DEEP = 0x3d88b4;
const WATER_MURKY = 0x8d7a4f;
const WATER_MURKY_DEEP = 0x6a5836;
const MUD = 0x6b5333;
/** 三条鱼的颜色（顺序与关卡脚本里的三条一致） */
const FISH_COLORS = [0xf0a63c, 0xe07a5f, 0x63b08a] as const;

/** 两种颜色之间插值：水由清到浑就是这一条 */
function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (v: number, w: number): number => Math.round(v + (w - v) * k);
  return (
    (ch((a >> 16) & 0xff, (b >> 16) & 0xff) << 16) |
    (ch((a >> 8) & 0xff, (b >> 8) & 0xff) << 8) |
    ch(a & 0xff, b & 0xff)
  );
}

/** 一条鱼：胖身子、尾巴、背鳍、两只眼睛（朝左朝右各画一边） */
function drawFish(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  color: number,
  flip: 1 | -1,
): void {
  groundShadow(g, x, y + 48 * s, 176 * s, 26 * s, 0.1);
  const t = (v: number): number => v * s * flip;
  // 尾巴
  g.fillStyle(shade(color, 0.86), 1);
  g.fillTriangle(x + t(-62), y, x + t(-124), y - 46 * s, x + t(-124), y + 46 * s);
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokeTriangle(x + t(-62), y, x + t(-124), y - 46 * s, x + t(-124), y + 46 * s);
  // 背鳍
  g.fillStyle(shade(color, 0.9), 1);
  g.fillTriangle(x + t(-18), y - 46 * s, x + t(36), y - 46 * s, x + t(8), y - 96 * s);
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokeTriangle(x + t(-18), y - 46 * s, x + t(36), y - 46 * s, x + t(8), y - 96 * s);
  // 身子
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, 158 * s, 106 * s);
  g.lineStyle(6 * s, THEME.outline, 1);
  g.strokeEllipse(x, y, 158 * s, 106 * s);
  // 鳃
  g.lineStyle(5 * s, shade(color, 0.76), 1);
  g.beginPath();
  g.arc(x + t(20), y, 32 * s, -1.05, 1.05);
  g.strokePath();
  // 眼睛（朝游的方向）
  circle(g, x + t(46), y - 14 * s, 15 * s, THEME.card, THEME.outline, 5 * s);
  g.fillStyle(THEME.ink, 1);
  g.fillCircle(x + t(49), y - 14 * s, 7 * s);
}

/** 鱼外面的进度圈：摸到几分一眼看得见 */
function drawRing(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  progress: number,
): void {
  const r = radius + 22;
  g.lineStyle(12, THEME.outline, 0.22);
  g.strokeCircle(x, y, r);
  if (progress <= 0) return;
  g.lineStyle(12, THEME.gold, 0.95);
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
  g.strokePath();
}

/** 岸：土坡、草、柳树、石头 */
function drawBank(g: Phaser.GameObjects.Graphics): void {
  const W = DESIGN.width;
  g.fillStyle(BANK, 1);
  g.fillRect(0, BANK_TOP, W, WATER_TOP - BANK_TOP);
  g.fillStyle(BANK_DEEP, 1);
  g.fillRect(0, WATER_TOP - 26, W, 26);
  g.lineStyle(7, THEME.leaf, 0.9);
  for (let x = 24; x < W; x += 58) g.lineBetween(x, WATER_TOP - 20, x + 10, WATER_TOP - 52);

  const { x, y } = WILLOW;
  groundShadow(g, x, y + 94, 176, 30, 0.18);
  g.fillStyle(shade(THEME.wood, 0.92), 1);
  g.fillRoundedRect(x - 17, y - 40, 34, 142, 12);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - 17, y - 40, 34, 142, 12);
  g.lineStyle(6, shade(THEME.leaf, 0.82), 0.95);
  for (let i = -3; i <= 3; i += 1) g.lineBetween(x + i * 26, y - 62, x + i * 31, y - 6);
  g.fillStyle(THEME.leaf, 1);
  g.fillEllipse(x, y - 84, 196, 100);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y - 84, 196, 100);

  circle(g, ROCK.x, ROCK.y, 42, THEME.stone, THEME.outline, 6);
  circle(g, ROCK.x + 54, ROCK.y + 18, 26, shade(THEME.stone, 1.08), THEME.outline, 5);
}

/** 水：清的时候是蓝的、波纹清楚；浑了变成泥色、底下翻起一坨一坨的泥 */
function drawWater(g: Phaser.GameObjects.Graphics, murk: number, t: number): void {
  const W = DESIGN.width;
  const H = DESIGN.height;
  const k = Math.max(0, Math.min(1, murk / 100));
  const top = mix(WATER_CLEAR, WATER_MURKY, k);
  const deep = mix(WATER_CLEAR_DEEP, WATER_MURKY_DEEP, k);
  g.fillStyle(top, 1);
  g.fillRect(0, WATER_TOP, W, H - WATER_TOP);
  g.fillStyle(deep, 1);
  g.fillRect(0, WATER_TOP + 230, W, H - WATER_TOP - 230);

  g.lineStyle(5, shade(top, 1.28), 0.5 * (1 - k * 0.65));
  for (let row = 0; row < 5; row += 1) {
    const y = WATER_TOP + 64 + row * 92;
    const drift = Math.sin(t / 900 + row) * 34;
    for (let i = 0; i < 3; i += 1) {
      const x = ((i * 280 + drift + row * 70) % (W + 220)) - 110;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 62, y - 12);
      g.lineTo(x + 124, y + 4);
      g.lineTo(x + 186, y - 8);
      g.strokePath();
    }
  }

  if (k <= 0.01) return;
  // 浑：一坨一坨的泥，顺着水慢慢转（越浑越浓、越多）
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + t / 2800;
    const cx = STIR_SPOT.x + Math.cos(angle) * (170 + (i % 4) * 74);
    const cy = 880 + Math.sin(angle) * (190 + (i % 3) * 84);
    g.fillStyle(MUD, 0.18 * k);
    g.fillEllipse(cx, cy, 150 + (i % 5) * 34, 76 + (i % 3) * 28);
  }
}

/** 搅水的那一圈：岸边斜插着一根竹竿，水面上是一圈一圈的亮圈 —— 点这儿水就浑 */
function drawStirSpot(
  g: Phaser.GameObjects.Graphics,
  state: StirStageState,
  t: number,
): void {
  const { x, y, radius } = state.stir;
  const k = Math.max(0, Math.min(1, state.murk / 100));
  const breathe = 0.72 + 0.28 * Math.sin(t / 260);
  g.lineStyle(7, THEME.card, 0.3 + 0.45 * (1 - k));
  for (let i = 0; i < 3; i += 1) {
    g.strokeCircle(x, y, (radius - 26 + i * 22) * (0.97 + 0.03 * breathe));
  }
  if (!state.muddy) {
    // 水清了：这一圈要一直亮着 —— 该搅了
    g.lineStyle(10, THEME.gold, 0.45 + 0.45 * breathe);
    g.strokeCircle(x, y, radius + 14 + 12 * breathe);
  }
  g.lineStyle(17, shade(THEME.wood, 1.04), 1);
  g.lineBetween(POLE.from.x, POLE.from.y, POLE.to.x, POLE.to.y);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(POLE.from.x, POLE.from.y, POLE.to.x, POLE.to.y);
  circle(g, POLE.from.x, POLE.from.y, 13, shade(THEME.wood, 0.9), THEME.outline, 5);
}

/** 竹篓：摸到的鱼摆进篓口 */
function drawCreel(g: Phaser.GameObjects.Graphics, caught: number): void {
  const { x, y } = CREEL;
  for (let i = 0; i < caught; i += 1) {
    drawFish(g, x - 40 + (i % 3) * 40, y - 56 - Math.floor(i / 3) * 30, 0.32, FISH_COLORS[i % 3]!, 1);
  }
  groundShadow(g, x, y + 68, 156, 30, 0.2);
  g.fillStyle(shade(THEME.wood, 1.06), 1);
  g.fillRoundedRect(x - 66, y - 40, 132, 112, 24);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeRoundedRect(x - 66, y - 40, 132, 112, 24);
  g.lineStyle(4, shade(THEME.wood, 0.76), 0.9);
  for (let i = 0; i < 4; i += 1) g.lineBetween(x - 58, y - 8 + i * 22, x + 58, y - 8 + i * 22);
  g.fillStyle(shade(THEME.wood, 0.86), 1);
  g.fillEllipse(x, y - 40, 138, 42);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeEllipse(x, y - 40, 138, 42);
}

/** 浑度尺：竖在水塘右边，门槛线画在 muddyAt 上（浑到线以上才抓得动） */
function drawMurkGauge(
  g: Phaser.GameObjects.Graphics,
  state: StirStageState,
  level: StirWindowLevel,
): void {
  const { x, y, w, h } = MURK_GAUGE;
  roundRect(g, x, y, w, h, w / 2, shade(THEME.card, 0.94), THEME.outline, 5);
  const k = Math.max(0, Math.min(1, state.murk / 100));
  const fillH = (h - 12) * k;
  if (fillH > 4) {
    roundRect(g, x + 6, y + h - 6 - fillH, w - 12, fillH, (w - 12) / 2, mix(0x9ad2e8, MUD, k), null, 0);
  }
  const lineY = y + h - 6 - (h - 12) * Math.max(0, Math.min(1, level.stir.muddyAt / 100));
  g.lineStyle(7, THEME.outline, 0.9);
  g.lineBetween(x - 16, lineY, x + w + 16, lineY);
  if (state.muddy) circle(g, x + w / 2, y - 30, 15, THEME.gold, THEME.outline, 4);
}

/** 整屏：岸、水、鱼、竹篓与浑度尺都按这一帧的 state 画 */
export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  state: StirStageState,
  level: StirWindowLevel,
): void {
  const W = DESIGN.width;
  const t = state.elapsedMs;

  g.fillStyle(SKY, 1);
  g.fillRect(0, BANK_TOP, W, WATER_TOP - BANK_TOP);
  drawBank(g);
  drawWater(g, state.murk, t);
  drawStirSpot(g, state, t);

  let caught = 0;
  level.jobs.forEach((job, index) => {
    if (state.done.includes(job.id)) {
      caught += 1;
      return;
    }
    drawFish(g, job.x, job.y, 0.92, FISH_COLORS[index % FISH_COLORS.length]!, index % 2 === 0 ? 1 : -1);
    drawRing(g, job.x, job.y, job.radius, state.work[job.id] ?? 0);
  });
  drawCreel(g, caught);
  drawMurkGauge(g, state, level);

  if (state.finished) {
    g.fillStyle(THEME.gold, 0.1);
    g.fillRect(0, BANK_TOP, W, DESIGN.height - BANK_TOP);
  }
}

/** 收尾：三条都摸到了 —— 水塘亮起来，竹篓边上撒一圈金 */
export function drawFinale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(THEME.gold, 0.13);
  g.fillCircle(STIR_SPOT.x, 900, 430);
  g.lineStyle(10, THEME.gold, 0.5);
  g.strokeCircle(STIR_SPOT.x, 900, 348);
  g.lineStyle(8, THEME.gold, 0.45);
  g.strokeCircle(CREEL.x, CREEL.y, 112);
}

/** 一面旗（分幕插图用；歪着的就是"阵脚乱了"） */
function drawBanner(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  lean: number,
  color: number,
): void {
  g.lineStyle(9 * s, shade(THEME.wood, 0.9), 1);
  g.lineBetween(x, y, x + lean, y - 118 * s);
  g.fillStyle(color, 1);
  g.fillTriangle(x + lean, y - 122 * s, x + lean, y - 70 * s, x + lean + 62 * s, y - 96 * s);
  g.lineStyle(5 * s, THEME.outline, 1);
  g.strokeTriangle(x + lean, y - 122 * s, x + lean, y - 70 * s, x + lean + 62 * s, y - 96 * s);
}

/**
 * 分幕插图：① 淝水两岸，秦军人多旗密，晋军人少 ② 秦军阵脚乱了，晋军趁乱过河
 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(SKY, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  // 岸
  g.fillStyle(BANK, 1);
  g.fillRoundedRect(x - 20, y + h * 0.3, w + 40, h * 0.22, 24);
  g.fillRoundedRect(x - 20, y + h * 0.66, w + 40, h * 0.3, 24);
  // 淝水
  g.fillStyle(mix(WATER_CLEAR, WATER_CLEAR_DEEP, 0.35), 1);
  g.fillRect(x - 20, y + h * 0.5, w + 40, h * 0.2);

  const banner = (bx: number, lean: number, color: number, s = 1): void =>
    drawBanner(g, bx, y + h * 0.52, s, lean, color);

  if (index === 0) {
    // 人多的一方：一排整整齐齐的旗（秦）
    for (let i = 0; i < 6; i += 1) banner(x + w * (0.08 + i * 0.11), -6, 0x8c5a4a, 0.82);
    // 人少的一方：两面旗，站得稳稳的（晋）
    banner(x + w * 0.62, 8, THEME.teal, 0.8);
    banner(x + w * 0.8, 4, THEME.teal, 0.8);
  } else {
    // 阵脚乱了：旗子东倒西歪
    for (let i = 0; i < 6; i += 1) banner(x + w * (0.08 + i * 0.11), i % 2 === 0 ? 34 : -40, 0x8c5a4a, 0.82);
    // 晋军趁乱过了河
    banner(x + w * 0.6, 6, THEME.teal, 0.86);
    g.fillStyle(THEME.teal, 1);
    for (let i = 0; i < 3; i += 1) {
      const px = x + w * (0.52 + i * 0.1);
      circle(g, px, y + h * 0.68 - i * 6, 17, THEME.teal, THEME.outline, 5);
      roundRect(g, px - 15, y + h * 0.7 - i * 6, 30, 48, 14, THEME.teal, THEME.outline, 5);
    }
    // 水花：过河那一下
    g.lineStyle(6, THEME.card, 0.8);
    g.strokeCircle(x + w * 0.5, y + h * 0.6, 44);
    g.strokeCircle(x + w * 0.62, y + h * 0.62, 26);
  }
}
