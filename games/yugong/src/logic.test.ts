import { getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { tapLevel } from './logic';

describe('愚公移山 · 关卡数据', () => {
  const raw = getEntry('yugong');

  it('连点挖山，四十担挖平', () => {
    const level = tapLevel(raw!);
    expect(level.mode).toBe('tap');
    expect(level.targetValue / level.stepValue).toBe(40);
  });

  it('三个里程碑：智叟 + 两次代际交接', () => {
    const level = tapLevel(raw!);
    expect(level.milestones.map((m) => m.id)).toEqual(['zhisou', 'gen-2', 'gen-3']);
  });

  it('里程碑按进度递增，不会挤在一起', () => {
    const level = tapLevel(raw!);
    const ats = level.milestones.map((m) => m.at);
    for (let i = 1; i < ats.length; i += 1) {
      expect(ats[i]!).toBeGreaterThan(ats[i - 1]!);
      expect(ats[i]! - ats[i - 1]!).toBeGreaterThan(0.15);
    }
  });

  it('智叟来得早（先被嘲笑，再谈传承）', () => {
    const level = tapLevel(raw!);
    expect(level.milestones[0]!.at).toBeLessThan(0.4);
  });

  it('故事很短', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });
});
