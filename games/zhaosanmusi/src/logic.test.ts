import { getEntry } from '@chags/content/full';
import { countsFor, happyLeft, isSplitSolved, mood, splitState } from '@chags/templates/split.logic';
import { describe, expect, it } from 'vitest';
import { LEFT_X, RIGHT_X, ROPE_Y } from './layout';
import { splitLevel } from './logic';

describe('朝三暮四 · 关卡数据', () => {
  const raw = getEntry('zhaosanmusi');
  const level = splitLevel(raw!);

  it('开局就是原文的分法：朝三暮四', () => {
    expect(level.total).toBe(7);
    expect(level.initialLeft).toBe(3);
    expect(countsFor(splitState(level.initialLeft, level), level)).toEqual({
      morning: 3,
      evening: 4,
    });
  });

  it('猴子只看早上那一头：三颗就闹，四颗就笑', () => {
    expect(level.audience.watchedBinId).toBe('morning');
    expect(mood(splitState(3, level), level)).toBe('angry');
    expect(mood(splitState(4, level), level)).toBe('happy');
  });

  it('挪一颗就分好了 —— 而总数一直是七颗', () => {
    const solved = splitState(happyLeft(level), level);
    expect(solved.left).toBe(4);
    expect(isSplitSolved(solved, level)).toBe(true);
    const counts = countsFor(solved, level);
    expect(counts.morning! + counts.evening!).toBe(7);
  });

  it('美术里的草绳与关卡数据一致 —— 否则绳子画在这儿、木牌动在那儿', () => {
    expect(level.bins[0]!.x).toBe(LEFT_X);
    expect(level.bins[1]!.x).toBe(RIGHT_X);
    expect(level.bins[0]!.y).toBe(ROPE_Y);
  });

  it('故事两幕、有一道迁移题', () => {
    expect(raw?.story.length).toBe(2);
    expect(raw?.quiz.some((q) => q.kind === 'transfer')).toBe(true);
  });
});
