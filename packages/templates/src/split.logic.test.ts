import { describe, expect, it } from 'vitest';
import { SplitLevelSchema } from './schemas';
import {
  clampLeft, countsFor, dividerX, happyLeft, isGreedy, isSplitSolved, leftFromX, mood,
  moodLine, splitState, stepToward, watchedCount,
} from './split.logic';

/** 七颗橡子：早上（左）四颗以下就闹，四颗就笑 */
const level = SplitLevelSchema.parse({
  total: 7,
  bins: [
    { id: 'morning', kind: 'morning', x: 150, y: 700, label: '早上' },
    { id: 'evening', kind: 'evening', x: 600, y: 700, label: '晚上' },
  ],
  initialLeft: 3,
  audience: {
    watchedBinId: 'morning',
    happyAt: 4,
    happyLine: '早上四颗！',
    angryLine: '怎么只有三颗！',
  },
  hint: '把木牌挪一挪',
});

describe('countsFor / watchedCount', () => {
  it('两头加起来永远是总数', () => {
    for (let left = 0; left <= level.total; left += 1) {
      const counts = countsFor(splitState(left, level), level);
      expect(counts.morning! + counts.evening!).toBe(level.total);
    }
  });

  it('观众看的是指定的那一头', () => {
    expect(watchedCount(splitState(3, level), level)).toBe(3);
    expect(watchedCount(splitState(4, level), level)).toBe(4);
  });
});

describe('mood', () => {
  it('照原文：朝三暮四则怒，朝四暮三则悦', () => {
    expect(mood(splitState(3, level), level)).toBe('angry');
    expect(mood(splitState(4, level), level)).toBe('happy');
    expect(moodLine(splitState(3, level), level)).toBe('怎么只有三颗！');
    expect(moodLine(splitState(4, level), level)).toBe('早上四颗！');
  });

  it('全给早上也高兴 —— 模板只报事实，不评价', () => {
    expect(mood(splitState(7, level), level)).toBe('happy');
    expect(isGreedy(splitState(7, level), level)).toBe(true);
    expect(isSplitSolved(splitState(7, level), level)).toBe(false);
  });

  it('四三才算分好了', () => {
    expect(isSplitSolved(splitState(4, level), level)).toBe(true);
    expect(isSplitSolved(splitState(3, level), level)).toBe(false);
    expect(isGreedy(splitState(4, level), level)).toBe(false);
  });

  it('观众盯着右边时，数的是右边', () => {
    const right = SplitLevelSchema.parse({
      ...level,
      audience: { ...level.audience, watchedBinId: 'evening' },
    });
    expect(watchedCount(splitState(3, right), right)).toBe(4);
    expect(mood(splitState(3, right), right)).toBe('happy');
    expect(happyLeft(right)).toBe(3);
  });
});

describe('拖动换算', () => {
  it('往左拖就是"早上少一颗"，而且夹在范围内', () => {
    expect(leftFromX(150, level, 150, 66)).toBe(0);
    expect(leftFromX(150 + 66 * 4, level, 150, 66)).toBe(4);
    expect(leftFromX(150 + 66 * 99, level, 150, 66)).toBe(7);
    expect(leftFromX(150 - 66 * 99, level, 150, 66)).toBe(0);
  });

  it('反推的像素位置是拖动的落点', () => {
    expect(dividerX(4, level, 150, 66)).toBe(150 + 66 * 4);
    expect(dividerX(99, level, 150, 66)).toBe(150 + 66 * 7);
  });
});

describe('happyLeft / stepToward', () => {
  it('一步一格地走向让观众高兴的分法', () => {
    expect(happyLeft(level)).toBe(4);
    let state = splitState(3, level);
    state = stepToward(state, happyLeft(level), level);
    expect(state.left).toBe(4);
    expect(stepToward(state, 4, level)).toBe(state);
  });

  it('clampLeft 把越界与小数都归一', () => {
    expect(clampLeft(-3, 7)).toBe(0);
    expect(clampLeft(99, 7)).toBe(7);
    expect(clampLeft(2.6, 7)).toBe(3);
  });
});

describe('schema', () => {
  it('挡住"永远高兴不起来"的关卡', () => {
    expect(() =>
      SplitLevelSchema.parse({ ...level, audience: { ...level.audience, happyAt: 9 } }),
    ).toThrow();
  });

  it('挡住"看着一个不存在的盘子"的关卡', () => {
    expect(() =>
      SplitLevelSchema.parse({ ...level, audience: { ...level.audience, watchedBinId: 'noon' } }),
    ).toThrow();
  });
});

describe('mark / split 模板注册', () => {
  it('两个新模板都在 schema 表里', async () => {
    const { templateSchemas } = await import('./schemas');
    expect(templateSchemas.mark).toBeDefined();
    expect(templateSchemas.split).toBeDefined();
  });
});
