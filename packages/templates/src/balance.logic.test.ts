import { describe, expect, it } from 'vitest';
import { clamp01, depthRatio, judge, markRatio, sumStones } from './balance.logic';
import { BalanceLevelSchema } from './schemas';
import type { BalanceLevel } from './schemas';

const level: BalanceLevel = BalanceLevelSchema.parse({
  prompt: 'x',
  targetWeight: 3000,
  capacity: 3600,
  tolerance: 100,
  stones: [
    { id: 'big', label: '大石头', value: 500 },
    { id: 'mid', label: '中石头', value: 300 },
    { id: 'small', label: '小石头', value: 100 },
  ],
  hintText: 'hint',
});

describe('balance 判定', () => {
  it('水痕比例 = 目标重量 / 载重上限', () => {
    expect(markRatio(level)).toBeCloseTo(3000 / 3600, 5);
  });

  it('严格相等时水痕正好对齐', () => {
    expect(depthRatio(3000, level)).toBeCloseTo(markRatio(level), 10);
  });

  it('容差内算对上', () => {
    expect(judge(3000, level)).toBe('match');
    expect(judge(2901, level)).toBe('match');
    expect(judge(3099, level)).toBe('match');
  });

  it('轻了 / 沉了都能区分', () => {
    expect(judge(2800, level)).toBe('light');
    expect(judge(3200, level)).toBe('heavy');
    expect(judge(0, level)).toBe('light');
  });

  it('大石头搬 6 块正好等于大象', () => {
    const total = sumStones([500, 500, 500, 500, 500, 500]);
    expect(total).toBe(3000);
    expect(judge(total, level)).toBe('match');
  });

  it('吃水比例永远被夹在 0..1，超载也不会画出屏幕', () => {
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(depthRatio(99_999, level)).toBe(1);
  });
});

describe('BalanceLevelSchema', () => {
  it('拒绝目标重量超过载重上限的关卡', () => {
    const bad = BalanceLevelSchema.safeParse({ ...level, targetWeight: 5000 });
    expect(bad.success).toBe(false);
  });
});
