import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { tapLevel } from './logic';

describe('夸父追日 · 关卡数据', () => {
  const raw = getEntry('kuafu');

  it('长按模式 —— 手感上就该是一直跑，而不是一直点', () => {
    const level = tapLevel(raw!);
    expect(level.mode).toBe('hold');
  });

  it('按住七秒多才追上（1800 里 ÷ 250 里每秒）', () => {
    const level = tapLevel(raw!);
    expect(level.targetValue / level.stepValue).toBeCloseTo(7.2, 6);
  });

  it('中途有河渭喝水的里程碑', () => {
    const level = tapLevel(raw!);
    expect(level.milestones.map((m) => m.id)).toContain('river');
    const river = level.milestones.find((m) => m.id === 'river');
    expect(river!.at).toBeGreaterThan(0.2);
    expect(river!.at).toBeLessThan(0.8);
  });

  it('故事很短', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });
});
