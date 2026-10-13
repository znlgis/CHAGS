import { describe, expect, it } from 'vitest';
import { clamp01, depthRatio, judge, markOffsetRatio, markRatio, sumStones } from './substitution.logic';
import { SubstitutionLevelSchema } from './schemas';
import type { SubstitutionLevel } from './schemas';

const level: SubstitutionLevel = SubstitutionLevelSchema.parse({
  heavy: { weight: 3000 },
  capacity: 3600,
  tolerance: 100,
  stones: [
    { id: 'big', value: 500, radius: 34 },
    { id: 'mid', value: 300, radius: 24 },
    { id: 'small', value: 100, radius: 16 },
  ],
  hints: { tooLight: '再加一些', tooHeavy: '拿走一块', stuck: '看看水痕' },
});

describe('等量代换判定', () => {
  it('水痕 = 重物重量 / 载重上限', () => {
    expect(markRatio(level)).toBeCloseTo(3000 / 3600, 5);
  });

  it('装到一样重时，水痕正好落到水面', () => {
    expect(depthRatio(3000, level)).toBeCloseTo(markRatio(level), 10);
  });

  it('容差内算对上，容差外分轻重', () => {
    expect(judge(3000, level)).toBe('match');
    expect(judge(2901, level)).toBe('match');
    expect(judge(3099, level)).toBe('match');
    expect(judge(2800, level)).toBe('light');
    expect(judge(3200, level)).toBe('heavy');
  });

  it('六块大石头正好等于一头象', () => {
    const total = sumStones([500, 500, 500, 500, 500, 500]);
    expect(total).toBe(3000);
    expect(judge(total, level)).toBe('match');
  });

  it('吃水比例永远夹在 0..1，超载也不会画出屏幕', () => {
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(depthRatio(99_999, level)).toBe(1);
  });

  it('水痕相对甲板的偏移与吃水互补', () => {
    expect(markOffsetRatio(level)).toBeCloseTo(1 - markRatio(level), 10);
  });
});

describe('SubstitutionLevelSchema', () => {
  it('拒绝重物超过载重上限的关卡', () => {
    expect(SubstitutionLevelSchema.safeParse({ ...level, heavy: { weight: 5000 } }).success).toBe(false);
  });

  it('拒绝凑不出答案的关卡（700 的倍数落在 2800/3500，离 3000 都超过容差）', () => {
    const bad = { ...level, stones: [{ id: 'odd', value: 700, radius: 40 }] };
    expect(SubstitutionLevelSchema.safeParse(bad).success).toBe(false);
  });
});
