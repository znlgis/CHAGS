import { getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { ADVANCE, ARCHER_X0, LEAVES, LEAF_RADII, archerAt } from './layout';
import { aimLevel, rungTargetId } from './logic';

describe('百步穿杨 · 关卡数据', () => {
  const raw = getEntry('yangyouji');
  const level = aimLevel(raw!);

  it('五档距离：十步 → 百步', () => {
    expect(level.ladder?.rungs.map((r) => r.label)).toEqual([
      '十步', '三十步', '五十步', '八十步', '百步',
    ]);
    expect(level.targets.length).toBe(5);
  });

  it('越远的柳叶越小 —— 半径一档比一档小', () => {
    const radii = level.targets.map((t) => t.radius ?? level.hitRadius);
    expect(radii).toEqual([...LEAF_RADII]);
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]!).toBeLessThan(radii[i - 1]!);
    }
  });

  it('柳叶越远越靠左，弓箭手越退越靠右 —— 距离是真的一档档拉开的', () => {
    for (let i = 1; i < level.targets.length; i += 1) {
      expect(level.targets[i]!.x).toBeLessThan(level.targets[i - 1]!.x);
    }
    const gapOf = (rung: number): number => {
      const target = level.targets[rung]!;
      return Math.abs(target.x - archerAt(rung).x);
    };
    expect(gapOf(4)).toBeGreaterThan(gapOf(0) * 5);
  });

  it('美术里的柳叶与关卡数据一致 —— 画的和射的必须是同一片', () => {
    level.targets.forEach((target, index) => {
      expect({ x: target.x, y: target.y }).toEqual({ ...LEAVES[index] });
    });
  });

  it('木牌位置与关卡数据一致，"再退十步"点得到', () => {
    expect(level.ladder?.advance).toEqual({ ...ADVANCE });
    expect(archerAt(0).x).toBe(ARCHER_X0);
  });

  it('每一档都指向一片真实存在的叶子', () => {
    level.ladder?.rungs.forEach((rung, index) => {
      expect(rungTargetId(level, index)).toBe(rung.targetId);
      expect(level.targets.some((t) => t.id === rung.targetId)).toBe(true);
    });
  });

  it('故事两幕，有一道迁移题（练出来的）', () => {
    expect(raw?.story.length).toBe(2);
    expect(raw?.quiz.some((q) => q.kind === 'transfer')).toBe(true);
  });
});
