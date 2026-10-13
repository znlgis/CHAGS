import { describe, expect, it } from 'vitest';
import {
  advanceHold,
  comboLevel,
  easedProgress,
  isTapComplete,
  pendingMilestones,
  progressFor,
  tapsNeeded,
} from './tap.logic';
import { TapLevelSchema } from './schemas';
import type { TapLevel } from './schemas';

const pangu: TapLevel = TapLevelSchema.parse({
  mode: 'tap',
  targetValue: 18000,
  stepValue: 600,
  unit: '年',
  resistance: 0.35,
  hint: '点一点，把天撑高',
});

const kuafu: TapLevel = TapLevelSchema.parse({
  mode: 'hold',
  targetValue: 900,
  stepValue: 180,
  unit: '里',
  resistance: 0.2,
  hint: '按住跑起来',
});

const yugong: TapLevel = TapLevelSchema.parse({
  mode: 'tap',
  targetValue: 3000,
  stepValue: 100,
  unit: '担',
  resistance: 0.25,
  hint: '接着挖',
  milestones: [
    { at: 0.34, id: 'zhisou' },
    { at: 0.66, id: 'generation-2' },
  ],
});

describe('tap 进度', () => {
  it('点满需要 30 次', () => {
    expect(tapsNeeded(pangu)).toBe(30);
  });

  it('进度夹在 0..1，且按缓动后更慢', () => {
    expect(progressFor(-5, pangu)).toBe(0);
    expect(progressFor(1e9, pangu)).toBe(1);
    expect(easedProgress(9000, pangu)).toBeLessThan(0.5);
    expect(easedProgress(18000, pangu)).toBeCloseTo(1, 6);
  });

  it('刚好点满才算完成', () => {
    expect(isTapComplete(17400, pangu)).toBe(false);
    expect(isTapComplete(18000, pangu)).toBe(true);
  });

  it('长按按时间推进，且不会超过目标', () => {
    expect(advanceHold(0, kuafu, 1000)).toBeCloseTo(180, 6);
    expect(advanceHold(0, kuafu, 500)).toBeCloseTo(90, 6);
    expect(advanceHold(880, kuafu, 5000)).toBe(900);
  });
});

describe('里程碑', () => {
  it('越过才触发，且只触发一次', () => {
    expect(pendingMilestones(yugong, 900, [])).toEqual([]);
    expect(pendingMilestones(yugong, 1020, [])).toEqual(['zhisou']);
    expect(pendingMilestones(yugong, 1020, ['zhisou'])).toEqual([]);
    expect(pendingMilestones(yugong, 2400, ['zhisou'])).toEqual(['generation-2']);
    expect(pendingMilestones(yugong, 3000, ['zhisou', 'generation-2'])).toEqual([]);
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

describe('TapLevelSchema', () => {
  it('tap 模式拒绝点不满的目标值', () => {
    expect(TapLevelSchema.safeParse({ ...pangu, targetValue: 18500 }).success).toBe(false);
  });

  it('hold 模式不要求整除', () => {
    expect(TapLevelSchema.safeParse({ ...kuafu, targetValue: 907 }).success).toBe(true);
  });

  it('拒绝重复的里程碑 id', () => {
    const bad = { ...yugong, milestones: [{ at: 0.3, id: 'x' }, { at: 0.6, id: 'x' }] };
    expect(TapLevelSchema.safeParse(bad).success).toBe(false);
  });
});
