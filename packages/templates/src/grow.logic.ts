import type { GrowLevel } from './schemas';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 计数进度 0..1 */
export function progressFor(value: number, level: GrowLevel): number {
  return clamp01(value / level.targetValue);
}

/**
 * 缝隙宽度：进度先过一遍阻力曲线。
 * resistance = 0 → 线性；越大 → 后半程天空升得越慢，手感上"越来越吃力"。
 */
export function gapFor(value: number, level: GrowLevel): number {
  const eased = Math.pow(progressFor(value, level), 1 + level.resistance);
  return level.startGap + (level.endGap - level.startGap) * eased;
}

/** 点满需要多少次（内容校验已保证能整除） */
export function tapsNeeded(level: GrowLevel): number {
  return Math.round(level.targetValue / level.stepValue);
}

export function isGrowComplete(value: number, level: GrowLevel): boolean {
  return value >= level.targetValue;
}

/** 连击等级：只影响表现（音调/星光），不影响数值，保证通关次数确定可测 */
export function comboLevel(intervalMs: number): 0 | 1 | 2 | 3 {
  if (intervalMs <= 160) return 3;
  if (intervalMs <= 320) return 2;
  if (intervalMs <= 600) return 1;
  return 0;
}
