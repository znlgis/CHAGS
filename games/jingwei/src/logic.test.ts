import { getAllusion } from '@chags/content';
import { tapsNeeded } from '@chags/templates/tap.logic';
import { describe, expect, it } from 'vitest';
import { tapLevel } from './logic';

describe('精卫填海 · 关卡数据', () => {
  const raw = getAllusion('jingwei');

  it('连点模式，三十下填满', () => {
    const level = tapLevel(raw!);
    expect(level.mode).toBe('tap');
    expect(tapsNeeded(level)).toBe(30);
  });

  it('计数单位是"块" —— 一次一块，正是这个典故的分量所在', () => {
    expect(tapLevel(raw!).unit).toBe('块');
  });

  it('故事很短', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });
});
