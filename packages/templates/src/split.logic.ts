import type { SplitLevel } from './schemas';

export interface SplitState {
  /** 分界木牌左边有几颗 */
  left: number;
}

export function clampLeft(left: number, total: number): number {
  return Math.min(total, Math.max(0, Math.round(left)));
}

export function splitState(left: number, level: SplitLevel): SplitState {
  return { left: clampLeft(left, level.total) };
}

/**
 * 两头各几颗。
 * **一份不多、一份不少** —— 守恒不是文案，是这一个函数。
 */
export function countsFor(state: SplitState, level: SplitLevel): Record<string, number> {
  const [first, second] = level.bins;
  const left = clampLeft(state.left, level.total);
  const counts: Record<string, number> = {};
  if (first) counts[first.id] = left;
  if (second) counts[second.id] = level.total - left;
  return counts;
}

/** 观众盯着的那一头有几颗 */
export function watchedCount(state: SplitState, level: SplitLevel): number {
  const counts = countsFor(state, level);
  return counts[level.audience.watchedBinId] ?? 0;
}

export function mood(state: SplitState, level: SplitLevel): 'happy' | 'angry' {
  return watchedCount(state, level) >= level.audience.happyAt ? 'happy' : 'angry';
}

/** 观众此刻说的话（高兴 / 生气各一句，双语可译） */
export function moodLine(state: SplitState, level: SplitLevel): string {
  return mood(state, level) === 'happy' ? level.audience.happyLine : level.audience.angryLine;
}

/** 有一头被分空了：猴子可能先高兴，晚上却要饿肚子 */
export function isGreedy(state: SplitState, level: SplitLevel): boolean {
  const left = clampLeft(state.left, level.total);
  return left < level.minPerSide || level.total - left < level.minPerSide;
}

/** 算分好了：观众高兴，而且两头都还留着 */
export function isSplitSolved(state: SplitState, level: SplitLevel): boolean {
  return mood(state, level) === 'happy' && !isGreedy(state, level);
}

/** 木牌拖到哪儿 = 左边几颗 */
export function leftFromX(x: number, level: SplitLevel, startX: number, gap: number): number {
  return clampLeft((x - startX) / gap, level.total);
}

/** 木牌该在的位置（按左边几颗反推像素） */
export function dividerX(left: number, level: SplitLevel, startX: number, gap: number): number {
  return startX + clampLeft(left, level.total) * gap;
}

/** 让观众高兴起来的分法 —— 无头验证与"卡住提示"都用它 */
export function happyLeft(level: SplitLevel): number {
  const watched = level.bins.find((bin) => bin.id === level.audience.watchedBinId);
  const isFirst = level.bins[0]?.id === watched?.id;
  return isFirst ? level.audience.happyAt : level.total - level.audience.happyAt;
}

/** 一步一格地走向目标（拖动是一格一格跳的，动画也照这个来） */
export function stepToward(state: SplitState, target: number, level: SplitLevel): SplitState {
  const wanted = clampLeft(target, level.total);
  if (wanted === state.left) return state;
  return { left: state.left + Math.sign(wanted - state.left) };
}
