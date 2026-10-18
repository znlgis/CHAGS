import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { aimLevel } from './logic';

describe('后羿射日 · 关卡数据', () => {
  const raw = getEntry('houyi');

  it('十日并出，但只需要射下九个', () => {
    const level = aimLevel(raw!);
    expect(level.targets.length).toBe(10);
    expect(level.goalCount).toBe(9);
  });

  it('射九留一：目标数必须大于 goalCount，否则没有"留一个"的余地', () => {
    const level = aimLevel(raw!);
    expect(level.goalCount).toBeLessThan(level.targets.length);
  });

  it('十个太阳都落在天空区域，不会跑到地面或屏幕外', () => {
    const level = aimLevel(raw!);
    for (const sun of level.targets) {
      expect(sun.x).toBeGreaterThan(80);
      expect(sun.x).toBeLessThan(700);
      expect(sun.y).toBeGreaterThan(200);
      expect(sun.y).toBeLessThan(600);
    }
  });

  it('太阳之间留得开，视觉上不会糊成一团', () => {
    // 注意：**不要求**两两距离大于 2*hitRadius。
    // 箭会被弹道上先碰到的那个挡住，这是刻意的语义（见 aim.logic 的 firstHit），
    // 实测最近一对相距 93.9 —— 只要不重叠到看不出是两个就行。
    const level = aimLevel(raw!);
    for (let i = 0; i < level.targets.length; i += 1) {
      for (let j = i + 1; j < level.targets.length; j += 1) {
        const a = level.targets[i]!;
        const b = level.targets[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(level.hitRadius * 1.4);
      }
    }
  });
});
