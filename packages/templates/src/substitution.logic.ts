import type { StoneDef, SubstitutionLevel } from './schemas';

export type WeighVerdict = 'light' | 'match' | 'heavy';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 重物上船时刻下的水痕位置（0=刚碰到水，1=完全没入） */
export function markRatio(level: SubstitutionLevel): number {
  return clamp01(level.heavy.weight / level.capacity);
}

/** 当前载重对应的吃水比例 */
export function depthRatio(total: number, level: SubstitutionLevel): number {
  return clamp01(total / level.capacity);
}

export function judge(total: number, level: SubstitutionLevel): WeighVerdict {
  const diff = total - level.heavy.weight;
  if (Math.abs(diff) <= level.tolerance) return 'match';
  return diff < 0 ? 'light' : 'heavy';
}

export function sumStones(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** 船身上某一点相对船头（甲板）的纵向偏移比例，用来把水痕画在船身上 */
export function markOffsetRatio(level: SubstitutionLevel): number {
  return 1 - markRatio(level);
}

/**
 * 该往船上再搬哪一块。
 * 无头验证（?autoplay=1）用它把一局走完；卡住时的兜底提示也可以用它。
 *
 * 规则：先挑"加上去不会冲过容差"的最大一块 —— 大石头步数少；
 * 一块都放不下（再放就一定偏重）时挑最小的一块，尽量贴近目标。
 * 这一条正是"光搬大石头凑不出来"的关卡所必需的：只搬最大的那种，
 * 会在偏轻与偏重之间来回跳，永远对不上水痕。
 */
export function nextStoneFor(total: number, level: SubstitutionLevel): StoneDef | undefined {
  if (level.stones.length === 0) return undefined;
  const ceiling = level.heavy.weight + level.tolerance;
  const fits = level.stones.filter((stone) => total + stone.value <= ceiling);
  if (fits.length > 0) {
    return fits.reduce((best, stone) => (stone.value > best.value ? stone : best));
  }
  return level.stones.reduce((best, stone) => (stone.value < best.value ? stone : best));
}
