import type { BalanceLevel } from './schemas';

export type BalanceVerdict = 'light' | 'match' | 'heavy';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 大象上船时留下的水痕位置（0=刚碰到水，1=完全没入） */
export function markRatio(level: BalanceLevel): number {
  return clamp01(level.targetWeight / level.capacity);
}

/** 当前载重对应的吃水比例 */
export function depthRatio(total: number, level: BalanceLevel): number {
  return clamp01(total / level.capacity);
}

export function judge(total: number, level: BalanceLevel): BalanceVerdict {
  const diff = total - level.targetWeight;
  if (Math.abs(diff) <= level.tolerance) return 'match';
  return diff < 0 ? 'light' : 'heavy';
}

export function sumStones(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
