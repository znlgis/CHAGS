import type { ChaseLevel } from './schemas';

/**
 * 追而不逼（chase）的纯判定：**按住就追近，松手就拉开 —— 难的是把距离维持在一个区间里**。
 *
 * 不 import Phaser —— 判定比画面重要得多，这些函数单测直接调。
 *
 * 三条刻意的设计：
 * - **距离是一个 0–100 的量**：按住按 closePerSec 缩、松手按 farPerSec 拉，两头都夹在 0–100。
 * - **只有待在区间里才掉体力**：距离落在 good 里，对方按 drainPerSec 掉体力；
 *   逼太近（< keepMin）他会反抗 —— 体力按 recoverPerSec 回涨，记一次 pushy；
 *   跟丢（> keepMax）这一段追逐的进度按 losePerSec 往后退，记一次 lost。
 * - **零惩罚**：逼太近、跟丢都**不结束、不扣星**，只是让你多花点时间 —— 接着维持就是。
 *   只有体力见底（stamina ≤ 0）才算成：那不是"抓住他"，是他自己心服了。
 */

/** 距离刻度的量程：0 = 贴在一起，100 = 彻底拉开 */
export const CHASE_MAX_DISTANCE = 100;

/** 追而不逼自己的时间常量（场景、单测、无头验证共用同一份） */
export const CHASE_TIMING = {
  /** 无头验证：体力那几条速率一起放大（距离的手感不变，压缩的只是"多久见底"） */
  autoplayFactor: 4,
  /** 无头验证：隔多久看一次"这一下该按还是该松" */
  autoplayLookMs: 60,
} as const;

/** 此刻这段距离算哪一段：太近 / 正好 / 太远 */
export type ChaseBand = 'tooClose' | 'good' | 'tooFar';

/** 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚 */
export interface ChaseState {
  /** 0–100：两个人之间那条刻度上的距离 */
  distance: number;
  /** 对方的体力：见底就是他心服了（永不小于 0，也不会超过开局那份） */
  stamina: number;
  /** 这段追逐的进度（0–100）：在区间里涨，跟丢时退 */
  progress: number;
  /** 上一次算出来的那一段 —— 只用来数"逼太近 / 跟丢"各几次 */
  band: ChaseBand;
  /** 逼得太近了几次（一次"由别处落进太近"算一次）—— 复盘用，不扣星 */
  pushy: number;
  /** 跟丢了几次（一次"由别处落进太远"算一次）—— 复盘用，不扣星 */
  lost: number;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 这段距离落在哪一段上：区间是**闭**的 [keepMin, keepMax] —— 正好压在线上算"正好" */
export function bandOf(level: ChaseLevel, distance: number): ChaseBand {
  if (distance < level.keepMin) return 'tooClose';
  if (distance > level.keepMax) return 'tooFar';
  return 'good';
}

/** 开一局：距离与体力照关卡数据，进度从 0 起，一次也没逼太近、没跟丢 */
export function chaseStart(level: ChaseLevel): ChaseState {
  const distance = clamp(level.start.distance, 0, CHASE_MAX_DISTANCE);
  return {
    distance,
    stamina: level.start.stamina,
    progress: 0,
    band: bandOf(level, distance),
    pushy: 0,
    lost: 0,
  };
}

/** 此刻距离落在哪一段（按 state.distance 现算，不看记账用的 state.band） */
export function distanceBand(level: ChaseLevel, state: ChaseState): ChaseBand {
  return bandOf(level, state.distance);
}

/** 要维持的那个区间的中点：无头验证拿它当"该收还是该放"的分界 */
export function chaseMid(level: ChaseLevel): number {
  return (level.keepMin + level.keepMax) / 2;
}

/**
 * 时间往前走一格。
 *
 * - holding = true：按住追 —— 距离按 closePerSec 缩；
 * - holding = false：松手 —— 距离按 farPerSec 拉；
 * - 体力见底之后这一局就定格了：再怎么按也不会重新爬起来（心服了就是心服了）。
 */
export function tick(
  level: ChaseLevel,
  state: ChaseState,
  dtMs: number,
  holding: boolean,
): ChaseState {
  if (!(dtMs > 0)) return state;
  if (isChaseDone(level, state)) return state;

  const dt = dtMs / 1000;
  const distance = clamp(
    state.distance + (holding ? -level.closePerSec : level.farPerSec) * dt,
    0,
    CHASE_MAX_DISTANCE,
  );
  const band = bandOf(level, distance);

  let stamina = state.stamina;
  let progress = state.progress;
  if (band === 'good') {
    // 不紧不松地跟着：他的力气一点一点耗掉，这一段追逐也在往前走
    stamina -= level.drainPerSec * dt;
    progress += level.drainPerSec * dt;
  } else if (band === 'tooClose') {
    // 逼太近，他回头就要打：力气回来了（**不结束、不扣星**）
    stamina += level.recoverPerSec * dt;
  } else {
    // 跟丢：白追一段，进度往后退（**不结束、不扣星**）
    progress -= level.losePerSec * dt;
  }

  return {
    distance,
    stamina: clamp(stamina, 0, level.start.stamina),
    progress: clamp(progress, 0, CHASE_MAX_DISTANCE),
    band,
    pushy: band === 'tooClose' && state.band !== 'tooClose' ? state.pushy + 1 : state.pushy,
    lost: band === 'tooFar' && state.band !== 'tooFar' ? state.lost + 1 : state.lost,
  };
}

/** 体力见底 = 他心服了，这一局就算成 */
export function isChaseDone(level: ChaseLevel, state: ChaseState): boolean {
  void level;
  return state.stamina <= 0;
}

/** 对方还剩几分力气（0..1）—— 画面上那条体力条按它画 */
export function staminaRatio(level: ChaseLevel, state: ChaseState): number {
  if (level.start.stamina <= 0) return 0;
  return clamp(state.stamina / level.start.stamina, 0, 1);
}

/** 这段追逐走了几分（0..1）—— 跟丢会往回走 */
export function progressRatio(state: ChaseState): number {
  return clamp(state.progress / CHASE_MAX_DISTANCE, 0, 1);
}

/** 逼太近了几次 */
export function pushyCount(state: ChaseState): number {
  return state.pushy;
}

/** 跟丢了几次 */
export function lostCount(state: ChaseState): number {
  return state.lost;
}

/**
 * 无头验证：这一刻该按住还是该松手？
 * 太近就松、太远就按；在区间里就朝中点收 —— 与孩子该做的事一模一样。
 */
export function holdWanted(level: ChaseLevel, state: ChaseState): boolean {
  const band = distanceBand(level, state);
  if (band === 'tooClose') return false;
  if (band === 'tooFar') return true;
  return state.distance > chaseMid(level);
}

/** 手指按在哪颗按钮上（宽容度让小朋友不用对准） */
export function hitHold(level: ChaseLevel, x: number, y: number, forgive = 0): boolean {
  const { hold } = level;
  return Math.hypot(x - hold.x, y - hold.y) <= hold.radius + forgive;
}

/**
 * 无头验证用的关卡：把"多久见底"压成几分之一（距离的手感一字不改）。
 * 体力那三条速率一起乘同一个倍数 —— 区间里掉得比逼太近回得快，这条关系不会翻。
 */
export function chaseAutoplayLevel(
  level: ChaseLevel,
  autoplay: boolean,
  factor = CHASE_TIMING.autoplayFactor,
): ChaseLevel {
  if (!autoplay || factor <= 1) return level;
  return {
    ...level,
    drainPerSec: level.drainPerSec * factor,
    recoverPerSec: level.recoverPerSec * factor,
    losePerSec: level.losePerSec * factor,
  };
}
