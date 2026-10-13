import { getAllusion } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { aimLevel } from './logic';

describe('后羿射日 · 关卡数据', () => {
  const raw = getAllusion('houyi');

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

  it('相邻太阳不会挤在一起（命中半径内只能有一个）', () => {
    const level = aimLevel(raw!);
    for (let i = 0; i < level.targets.length; i += 1) {
      for (let j = i + 1; j < level.targets.length; j += 1) {
        const a = level.targets[i]!;
        const b = level.targets[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(level.hitRadius);
      }
    }
  });

  it('故事很短，屏幕上不超过两句话', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });
});
