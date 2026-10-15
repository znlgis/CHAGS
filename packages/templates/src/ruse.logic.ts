import type { RuseItem, RuseLevel, RuseNoise, RuseShell } from './schemas';

/**
 * 示形（ruse）的纯判定：灯什么时候亮、照哪一边、谁被看见、谁算过关。
 *
 * **不 import Phaser** —— 判定的边界比画面重要得多，这些函数单测直接调。
 * 关卡脚本里只有 intervalMs（多久亮一次）与 warnMs（亮之前的征兆），
 * "亮多久"由 litRatio 按周期推出来：这样无头验证把周期压短时，
 * 暗 / 征兆 / 亮三个时刻仍然自洽（按比例一起缩）。
 */

/** 示形模板的时间常量（场景、单测、e2e 共用同一份） */
export const RUSE_TIMING = {
  /** 灯亮着的时长 = 周期 × 这个比例（区间内再夹一下，见 litMsFor） */
  litRatio: 0.27,
  /** 再短的周期，灯也要亮够这么久，孩子才看得见 */
  litMsMin: 240,
  /** 再长的周期，灯也只是亮一小会儿 */
  litMsMax: 1400,
  /** 敲一下锣鼓，隔多久才能再敲（按住不放，"等时机"这件事就没有了） */
  noiseCooldownMs: 2600,
  /** 无头验证：把灯的周期压成几分之一 */
  autoplayFactor: 4,
  /** 无头验证：周期再快也不短于这个 */
  autoplayMinCycleMs: 900,
  /** hide 模式没有 gaze，也需要一条"左右的分界"：通道正中 */
  midX: 375,
} as const;

export type LampPhase = 'dark' | 'warn' | 'lit';
export type GazeSide = 'left' | 'right';

/** 灯亮多久：跟着周期走（无头验证压缩后仍然自洽） */
export function litMsFor(level: RuseLevel): number {
  const raw = Math.round(level.lamp.intervalMs * RUSE_TIMING.litRatio);
  return Math.max(RUSE_TIMING.litMsMin, Math.min(RUSE_TIMING.litMsMax, raw));
}

/** 周期内的时间：负数（单测里回看上一轮）也回到 0..intervalMs */
function clockIn(level: RuseLevel, t: number): number {
  const cycle = level.lamp.intervalMs;
  return ((t % cycle) + cycle) % cycle;
}

/** 灯亮的时刻在这一轮的哪个位置（从这一轮开头算） */
function lightAt(level: RuseLevel): number {
  return level.lamp.intervalMs - litMsFor(level);
}

/** 第几轮灯（从 0 开始）：灯每一轮亮一次，轮次也决定"这一轮照哪一边" */
export function lampIndex(level: RuseLevel, t: number): number {
  return Math.floor(t / level.lamp.intervalMs);
}

/**
 * 这一刻灯处在哪个阶段：
 * 一轮 = 暗 → 征兆（warnMs）→ 亮（litMs）→ 下一轮。
 * warnMs 比一整轮还长时整轮都在征兆（数据再离谱也不会算出负的时长）。
 */
export function lampPhase(level: RuseLevel, t: number): LampPhase {
  const cycle = level.lamp.intervalMs;
  const lit = litMsFor(level);
  const warn = Math.min(Math.max(0, level.lamp.warnMs), Math.max(0, cycle - lit));
  const at = clockIn(level, t);
  if (at >= cycle - lit) return 'lit';
  if (at >= cycle - lit - warn) return 'warn';
  return 'dark';
}

/** 还有多久亮（已经亮着时是 0）—— 画"征兆"的进度用 */
export function msToLight(level: RuseLevel, t: number): number {
  const at = clockIn(level, t);
  const light = lightAt(level);
  return at < light ? light - at : 0;
}

/** 这一轮还亮多久（不在亮的阶段时是 0） */
export function msLitLeft(level: RuseLevel, t: number): number {
  if (lampPhase(level, t) !== 'lit') return 0;
  return level.lamp.intervalMs - clockIn(level, t);
}

/**
 * 灯照哪一边。
 *
 * 不敲锣时一轮换一边：偶数轮照左、奇数轮照右（征兆亮起来的时候就能看出这一轮照哪儿）。
 * 敲过锣之后 holdUntilMs 之前一直照左 —— 这就是"声东"：把那边的热闹做大，
 * 人从另一边（右侧）走过去。holdUntilMs 之后立刻回到"一轮换一边"的正常节奏。
 */
export function gazeSide(level: RuseLevel, t: number, holdUntilMs = 0): GazeSide {
  if (holdUntilMs > t) return 'left';
  const index = ((lampIndex(level, t) % 2) + 2) % 2;
  return index === 0 ? 'left' : 'right';
}

/** 一件东西此刻在通道的哪一边（divert 用；分界取两处 gaze 的中点） */
export function sideAt(level: RuseLevel, x: number): GazeSide {
  const left = level.gaze?.left.x;
  const right = level.gaze?.right.x;
  const mid = left !== undefined && right !== undefined ? (left + right) / 2 : RUSE_TIMING.midX;
  return x <= mid ? 'left' : 'right';
}

/** 这一刻的"视线"：外壳 / 在哪一边 / 锣声把灯留到什么时候 / 是否已过关 */
export interface RuseSight {
  /** hide：此刻套着哪个外壳（没套就是 null） */
  shellKind?: string | null;
  /** divert：这件东西此刻在通道的哪一边 */
  side?: GazeSide;
  /** 锣声把灯留在左边的截止时刻 */
  holdUntilMs?: number;
  /** 已经过关的东西：永久安全 */
  passed?: boolean;
}

/** 外壳正好是它该装成的样子吗 */
export function isDisguised(item: RuseItem, shellKind: string | null | undefined): boolean {
  return item.disguiseAs !== undefined && shellKind === item.disguiseAs;
}

/**
 * 此刻被灯看见了吗？
 * - 已经过关：永久安全（这就是"拖过检查口"的意义）；
 * - 灯没亮：谁也看不见；
 * - hide：外壳不是它该装成的样子 → 被看见；
 * - divert：灯正好照在它这一边 → 被看见（不吃外壳，靠的就是时机）。
 */
export function isExposed(
  level: RuseLevel,
  item: RuseItem,
  t: number,
  sight: RuseSight = {},
): boolean {
  if (sight.passed) return false;
  if (lampPhase(level, t) !== 'lit') return false;
  if (level.mode === 'hide') return !isDisguised(item, sight.shellKind);
  return gazeSide(level, t, sight.holdUntilMs ?? 0) === (sight.side ?? 'right');
}

/** 拖过检查口了吗（宽容度让小朋友不用像素级对准） */
export function isCarriedPast(level: RuseLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.gate.x, y - level.gate.y) <= level.gate.radius + forgive;
}

/** 每一件都过了检查口，这一局才算成 */
export function isRuseComplete(level: RuseLevel, passedIds: readonly string[]): boolean {
  const done = new Set(passedIds);
  return level.items.every((item) => done.has(item.id));
}

/** 还没过关的第一件（无头验证按这个顺序走，与关卡脚本里的顺序一致） */
export function nextItemToCarry(
  level: RuseLevel,
  passedIds: readonly string[],
): RuseItem | undefined {
  const done = new Set(passedIds);
  return level.items.find((item) => !done.has(item.id));
}

/**
 * 从现在起的 windowMs 之内都不会被看见吗？
 * 无头验证用它确认"这一趟走得完"再动身 —— 否则会被退回来，白跑一趟。
 */
export function safeFor(
  level: RuseLevel,
  item: RuseItem,
  t: number,
  windowMs: number,
  sight: RuseSight = {},
): boolean {
  if (isExposed(level, item, t, sight)) return false;
  const steps = 4;
  for (let i = 1; i <= steps; i += 1) {
    if (isExposed(level, item, t + (windowMs * i) / steps, sight)) return false;
  }
  return true;
}

/** 无头验证用的关卡：灯的周期与锣声的时长按**同一个比例**压短 */
export function autoplayLevel(
  level: RuseLevel,
  autoplay: boolean,
  factor = RUSE_TIMING.autoplayFactor,
): RuseLevel {
  if (!autoplay) return level;
  const interval = Math.max(
    RUSE_TIMING.autoplayMinCycleMs,
    Math.round(level.lamp.intervalMs / factor),
  );
  const scale = interval / level.lamp.intervalMs;
  return {
    ...level,
    lamp: {
      ...level.lamp,
      intervalMs: interval,
      warnMs: Math.max(60, Math.round(level.lamp.warnMs * scale)),
    },
    noises: level.noises.map((noise) => ({
      ...noise,
      holdMs: Math.max(RUSE_TIMING.litMsMin, Math.round(noise.holdMs * scale)),
    })),
  };
}

// ---------------- 点选判定：手指粗也能点得到（与 drag.ts 同一套路：算距离，不依赖命中区域） ----------------

export interface ShellPick {
  item: RuseItem;
  shell: RuseShell;
}

/** 手指落在哪个外壳上（拿最近的那个） */
export function shellAt(level: RuseLevel, x: number, y: number, radius = 0): ShellPick | undefined {
  let best: ShellPick | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const item of level.items) {
    for (const shell of item.shells) {
      const dist = Math.hypot(x - shell.x, y - shell.y);
      if (dist <= radius && dist < bestDist) {
        best = { item, shell };
        bestDist = dist;
      }
    }
  }
  return best;
}

/** 手指落在哪件东西上（拿最近的那个） */
export function itemAt(level: RuseLevel, x: number, y: number, radius = 0): RuseItem | undefined {
  let best: RuseItem | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const item of level.items) {
    const dist = Math.hypot(x - item.x, y - item.y);
    if (dist <= radius && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指落在哪个锣鼓上（拿最近的那个） */
export function noiseAt(level: RuseLevel, x: number, y: number, radius = 0): RuseNoise | undefined {
  let best: RuseNoise | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const noise of level.noises) {
    const dist = Math.hypot(x - noise.x, y - noise.y);
    if (dist <= radius && dist < bestDist) {
      best = noise;
      bestDist = dist;
    }
  }
  return best;
}

/** 无头验证轮流敲：没有锣鼓就返回 undefined */
export function noiseForKnock(level: RuseLevel, index: number): RuseNoise | undefined {
  if (level.noises.length === 0) return undefined;
  return level.noises[((index % level.noises.length) + level.noises.length) % level.noises.length];
}
