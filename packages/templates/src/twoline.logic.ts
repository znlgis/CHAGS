import type { TwolineLevel } from './schemas';

/**
 * 双线（twoline）的纯判定：明面撑住、暗里推进，两条线抢**同一根手指**。
 *
 * 这一关的账本只有一本：明线（修栈道）随时间往下掉，点一下补一截；
 * 暗线（走小路）点一下推一截，到 goal 就成。两条线各占一只手的时间 ——
 * 只顾暗线会被看穿，只顾明线推不动。**被看穿不是失败**：明线立刻补回 minKeep、
 * 记一次"被看穿"，接着玩就是（零惩罚是这一系列的地基）。
 *
 * 判定全部按**时间轴**算（t 是从这一局开始算起的毫秒数）：
 * 场景每帧把墙钟喂进来结账，单测直接喂数字 —— 同一份判定，两边不会跑偏。
 * **不 import Phaser**。
 */

/** 双线的手感常量（场景、单测、无头验证共用同一份） */
export const TWOLINE_TIMING = {
  /** 明线掉到 minKeep 的这个倍数以下，就该补一笔了 —— 小手与无头验证都看它 */
  urgentRatio: 1.5,
  /**
   * 两次"被看穿"之间至少隔这么久。
   * 明线一旦跌到 minKeep 就停在那个高度（画面红着，提醒你该补了），
   * 没有这个间隔的话，"只顾暗线"的那几秒会被每帧记一次账。
   */
  exposeGapMs: 2600,
} as const;

/** 浮点容差：4 加二十五次不会正好是漂亮的 100 */
const EPS = 1e-9;

/** 一局里攒下来的东西：明线到哪儿了、暗线推到哪儿了、被抓过几次 */
export interface TwolineState {
  /** 明线上一次结算的值 */
  decoy: number;
  /** 明线上一次结算的时刻 */
  decoyAtMs: number;
  /** 暗线推到多少了 */
  real: number;
  /** 被看穿了几次（零惩罚，只用来复盘） */
  exposed: number;
  /** 上一次被看穿是什么时候（表演与"别连珠炮记账"都用它） */
  lastExposedAtMs: number | null;
  /** 暗线点了几下 */
  taps: number;
  /** 明线补了几笔 */
  decoyTaps: number;
}

/**
 * 开局：明线是**满的**。
 * 栈道本来就修在那里、大家一起敲敲打打 —— 这一关要的是维持它，不是从零开始修，
 * 所以 decoy 从 max 起（这也是它必须拿到关卡数据的原因）。
 */
export function twolineStart(level: TwolineLevel): TwolineState {
  return {
    decoy: level.decoy.max,
    decoyAtMs: 0,
    real: 0,
    exposed: 0,
    lastExposedAtMs: null,
    taps: 0,
    decoyTaps: 0,
  };
}

/**
 * 明线此刻的值：从上次结算起，按 decayPerSec 往下掉，夹在 0..max。
 * t 早于上次结算（单测里回看）时按"还没掉"算 —— 不会算出比上次更高的数。
 */
export function decoyNow(level: TwolineLevel, state: TwolineState, t: number): number {
  const sinceMs = Math.max(0, Math.max(0, t) - state.decoyAtMs);
  const value = state.decoy - (level.decoy.decayPerSec * sinceMs) / 1000;
  return Math.min(level.decoy.max, Math.max(0, value));
}

/** 明线还剩几成（0..1）—— 画面上的栈道按它画 */
export function decoyRatio(level: TwolineLevel, state: TwolineState, t: number): number {
  const { max } = level.decoy;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, decoyNow(level, state, t) / max));
}

/** 明线还剩多久会跌破 minKeep（已经跌破了 = 0）—— 画面上的那个钟 */
export function safeMsLeft(level: TwolineLevel, state: TwolineState, t: number): number {
  const above = decoyNow(level, state, t) - level.decoy.minKeep;
  if (above <= 0) return 0;
  return (above / level.decoy.decayPerSec) * 1000;
}

/** 明线该补一笔了吗：掉到 minKeep 的 urgentRatio 倍以下 */
export function needsTopUp(
  level: TwolineLevel,
  state: TwolineState,
  t: number,
  ratio = TWOLINE_TIMING.urgentRatio,
): boolean {
  return decoyNow(level, state, t) < level.decoy.minKeep * ratio;
}

/** 明线跌破 minKeep = 被看穿 */
export function isExposed(level: TwolineLevel, state: TwolineState, t: number): boolean {
  return decoyNow(level, state, t) + EPS < level.decoy.minKeep;
}

/**
 * 结账：把明线推到此刻。
 * - 还在 minKeep 之上：照常往下掉多少就是多少；
 * - 跌破了：**立刻补回 minKeep**、记一次"被看穿"，然后停在 minKeep 上等你补一笔。
 *
 * 场景每帧调它一次，所以孩子看到的明线始终是最新的值；
 * 被看穿**不结束、不扣星**，只是把"你只顾着暗线"这件事说出来。
 */
export function settleDecoy(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const now = Math.max(0, t);
  const value = decoyNow(level, state, t);
  if (value + EPS >= level.decoy.minKeep) {
    return { ...state, decoy: value, decoyAtMs: now };
  }
  // 刚刚被抓过就不再重复记账（见 exposeGapMs）
  const recent =
    state.lastExposedAtMs !== null && now - state.lastExposedAtMs < TWOLINE_TIMING.exposeGapMs;
  return {
    ...state,
    decoy: level.decoy.minKeep,
    decoyAtMs: now,
    exposed: recent ? state.exposed : state.exposed + 1,
    lastExposedAtMs: recent ? state.lastExposedAtMs : now,
  };
}

/** 补一笔明线：先结账，再加上 topUp（封顶 max） */
export function tapDecoy(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const settled = settleDecoy(level, state, t);
  return {
    ...settled,
    decoy: Math.min(level.decoy.max, settled.decoy + level.decoy.topUp),
    decoyAtMs: Math.max(0, t),
    decoyTaps: settled.decoyTaps + 1,
  };
}

/** 点一下暗线：推 step，封顶在 goal */
export function tapReal(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const settled = settleDecoy(level, state, t);
  return {
    ...settled,
    real: Math.min(level.real.goal, settled.real + level.real.step),
    taps: settled.taps + 1,
  };
}

/** 暗线推到几成（0..1） */
export function realRatio(level: TwolineLevel, state: TwolineState): number {
  if (level.real.goal <= 0) return 1;
  return Math.min(1, Math.max(0, state.real / level.real.goal));
}

/** 暗线还要点几下（提示与关卡验算都看它） */
export function tapsLeft(level: TwolineLevel, state: TwolineState): number {
  if (level.real.step <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil((level.real.goal - state.real) / level.real.step - EPS));
}

/** 暗线点到 goal 就算成 —— 明线被看穿多少次都不影响这一条 */
export function isTwolineDone(level: TwolineLevel, state: TwolineState): boolean {
  return state.real + EPS >= level.real.goal;
}

/**
 * 接下来该点哪条线（小手、提示与无头验证都用它）：
 * 明线快到线了就先撑着，其余时间推暗线。
 */
export function nextLineToTap(
  level: TwolineLevel,
  state: TwolineState,
  t: number,
): 'decoy' | 'real' | null {
  if (needsTopUp(level, state, t)) return 'decoy';
  return isTwolineDone(level, state) ? null : 'real';
}

// ---------------- 点选判定：手指粗也能点得到（与 siege / ruse 同一套路：算距离，不依赖命中区域） ----------------

/** 手指落在明线（栈道）上吗 */
export function hitDecoy(level: TwolineLevel, x: number, y: number, forgive = 0): boolean {
  const { x: cx, y: cy, radius } = level.decoy;
  return Math.hypot(x - cx, y - cy) <= radius + forgive;
}

/** 手指落在暗线（小路）上吗 */
export function hitReal(level: TwolineLevel, x: number, y: number, forgive = 0): boolean {
  const { x: rx, y: ry, radius } = level.real;
  return Math.hypot(x - rx, y - ry) <= radius + forgive;
}
