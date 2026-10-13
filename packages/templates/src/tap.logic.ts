import type { TapLevel } from './schemas';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 原始进度 0..1 */
export function progressFor(value: number, level: TapLevel): number {
  return clamp01(value / level.targetValue);
}

/** 画面用的缓动进度：resistance 越大，后半程显得越吃力 */
export function easedProgress(value: number, level: TapLevel): number {
  return Math.pow(progressFor(value, level), 1 + level.resistance);
}

export function isTapComplete(value: number, level: TapLevel): boolean {
  return value >= level.targetValue;
}

/** tap 模式点满需要多少次（内容校验已保证能整除） */
export function tapsNeeded(level: TapLevel): number {
  return Math.max(1, Math.round(level.targetValue / level.stepValue));
}

/** hold 模式：按住 deltaMs 之后的新数值 */
export function advanceHold(value: number, level: TapLevel, deltaMs: number): number {
  return Math.min(level.targetValue, value + (level.stepValue * deltaMs) / 1000);
}

/** 连击等级：只影响表现（音调 / 星光），不影响数值，保证通关次数确定可测 */
export function comboLevel(intervalMs: number): 0 | 1 | 2 | 3 {
  if (intervalMs <= 160) return 3;
  if (intervalMs <= 320) return 2;
  if (intervalMs <= 600) return 1;
  return 0;
}

/** 已经越过、但还没触发过的里程碑 id */
export function pendingMilestones(
  level: TapLevel,
  value: number,
  fired: readonly string[],
): string[] {
  const progress = progressFor(value, level);
  return level.milestones
    .filter((m) => progress >= m.at && !fired.includes(m.id))
    .map((m) => m.id);
}
