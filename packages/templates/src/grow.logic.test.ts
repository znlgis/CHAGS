import { describe, expect, it } from 'vitest';
import { comboLevel, gapFor, isGrowComplete, progressFor, tapsNeeded } from './grow.logic';
import { GrowLevelSchema } from './schemas';
import type { GrowLevel } from './schemas';

const level: GrowLevel = GrowLevelSchema.parse({
  startGap: 40,
  endGap: 700,
  targetValue: 18000,
  stepValue: 600,
  unit: '年',
  resistance: 0.35,
  hint: '点一点',
});

describe('撑天进度', () => {
  it('点满需要 30 次', () => {
    expect(tapsNeeded(level)).toBe(30);
  });

  it('起点与终点分别对应起始缝隙与最大缝隙', () => {
    expect(gapFor(0, level)).toBeCloseTo(40, 6);
    expect(gapFor(18000, level)).toBeCloseTo(700, 6);
  });

  it('前半程升得比线性更快，后半程慢下来（"越来越吃力"）', () => {
    const half = gapFor(9000, level);
    const linear = 40 + (700 - 40) * 0.5;
    expect(half).toBeLessThan(linear);
  });

  it('缝隙单调不减，且不会越过终点', () => {
    let prev = -1;
    for (let v = 0; v <= 18000; v += 600) {
      const gap = gapFor(v, level);
      expect(gap).toBeGreaterThanOrEqual(prev);
      prev = gap;
    }
    expect(gapFor(99999, level)).toBeCloseTo(700, 6);
  });

  it('进度夹在 0..1', () => {
    expect(progressFor(-5, level)).toBe(0);
    expect(progressFor(1e9, level)).toBe(1);
  });

  it('刚好点满才算完成', () => {
    expect(isGrowComplete(17400, level)).toBe(false);
    expect(isGrowComplete(18000, level)).toBe(true);
  });
});

describe('连击', () => {
  it('点得越快等级越高', () => {
    expect(comboLevel(100)).toBe(3);
    expect(comboLevel(300)).toBe(2);
    expect(comboLevel(500)).toBe(1);
    expect(comboLevel(2000)).toBe(0);
  });
});

describe('GrowLevelSchema', () => {
  it('拒绝点不满的目标值', () => {
    const bad = { ...level, targetValue: 18500 };
    expect(GrowLevelSchema.safeParse(bad).success).toBe(false);
  });

  it('拒绝终点缝隙小于起点', () => {
    expect(GrowLevelSchema.safeParse({ ...level, endGap: 10 }).success).toBe(false);
  });
});
