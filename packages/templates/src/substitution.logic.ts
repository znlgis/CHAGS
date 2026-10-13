import type { SubstitutionLevel } from './schemas';

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
