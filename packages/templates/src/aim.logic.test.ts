import { describe, expect, it } from 'vitest';
import { aimDirection, distanceToSegment, firstHit, projectionT, pullAmount } from './aim.logic';
import { AimLevelSchema } from './schemas';
import type { AimLevel } from './schemas';

const level: AimLevel = AimLevelSchema.parse({
  targets: [
    { id: 'sun-1', x: 200, y: 300, kind: 'sun' },
    { id: 'sun-2', x: 500, y: 300, kind: 'sun' },
  ],
  hitRadius: 60,
  arrowSpeed: 1200,
  goalCount: 1,
  hint: '拖出去瞄准',
});

describe('瞄准', () => {
  it('拉得太短不算射击', () => {
    expect(aimDirection({ x: 100, y: 100 }, { x: 110, y: 100 })).toBeNull();
    expect(aimDirection({ x: 100, y: 100 }, { x: 100, y: 0 })).toEqual({ x: 0, y: -1 });
  });

  it('拉弓程度夹在 0..1', () => {
    expect(pullAmount({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(pullAmount({ x: 0, y: 0 }, { x: 110, y: 0 })).toBeCloseTo(0.5, 6);
    expect(pullAmount({ x: 0, y: 0 }, { x: 9999, y: 0 })).toBe(1);
  });

  it('点到线段的距离：垂足在段内 / 段外两种情况都对', () => {
    expect(distanceToSegment({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(30, 6);
    // 段外：退化成到端点的距离
    expect(distanceToSegment({ x: -40, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(40, 6);
  });

  it('高速的箭按线段扫过的范围判定，不会穿过目标', () => {
    // 一帧从 (0,300) 飞到 (700,300)，途中经过两个太阳
    const hit = firstHit({ x: 0, y: 300 }, { x: 700, y: 300 }, level.targets, level.hitRadius);
    expect(hit).toBe('sun-1');
  });

  it('打偏了就是空', () => {
    expect(firstHit({ x: 0, y: 900 }, { x: 700, y: 900 }, level.targets, level.hitRadius)).toBeNull();
  });

  it('两个都在弹道上时，取箭先碰到的那一个（与数组顺序无关）', () => {
    const reversed = [...level.targets].reverse();
    expect(firstHit({ x: 0, y: 300 }, { x: 700, y: 300 }, reversed, level.hitRadius)).toBe('sun-1');
    // 反方向射，就先碰到 sun-2
    expect(firstHit({ x: 700, y: 300 }, { x: 0, y: 300 }, reversed, level.hitRadius)).toBe('sun-2');
  });

  it('投影位置夹在 0..1', () => {
    expect(projectionT({ x: 0, y: 300 }, { x: 0, y: 300 }, { x: 700, y: 300 })).toBe(0);
    expect(projectionT({ x: 700, y: 300 }, { x: 0, y: 300 }, { x: 700, y: 300 })).toBe(1);
    expect(projectionT({ x: -999, y: 300 }, { x: 0, y: 300 }, { x: 700, y: 300 })).toBe(0);
  });
});

describe('AimLevelSchema', () => {
  it('拒绝把目标射光的设计（必须留一个）', () => {
    expect(AimLevelSchema.safeParse({ ...level, goalCount: 2 }).success).toBe(false);
  });

  it('拒绝重复 id', () => {
    const bad = { ...level, targets: [{ id: 'a', x: 1, y: 1, kind: 'sun' }, { id: 'a', x: 2, y: 2, kind: 'sun' }] };
    expect(AimLevelSchema.safeParse(bad).success).toBe(false);
  });
});
