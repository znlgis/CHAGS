import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { borrowLevel } from './logic';

const entry = getEntry('jiedao-sharen')!;
const level = borrowLevel(entry);

describe('借刀杀人 · 关卡数据', () => {
  it('工地：大石 40 斤重，(500,1000) 上，需要 30 的力', () => {
    expect(level.load).toEqual({ x: 500, y: 1000, radius: 120, weight: 40 });
    expect(level.needed).toBe(30);
  });

  it('自己只有 1 点力，木棍 12 + 水车 18 正好 30，老牛 14', () => {
    const powers = Object.fromEntries(level.props.map((p) => [p.id, p.power]));
    expect(powers).toEqual({ self: 1, fulcrum: 0, stick: 12, wheel: 18, ox: 14 });
    expect(level.props.map((p) => p.kind)).toEqual(['self', 'fulcrum', 'source', 'source', 'source']);
    expect(level.props.find((p) => p.id === 'fulcrum')?.x).toBe(430);
    const stick = level.props.find((p) => p.id === 'stick')!;
    const wheel = level.props.find((p) => p.id === 'wheel')!;
    expect(stick.power + wheel.power).toBe(level.needed);
  });

  it('两幕故事，关键抉择点在第二幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('迁移题与史源：子贡一出，存鲁乱齐破吴强晋而霸越（《史记·仲尼弟子列传》）', () => {
    expect(entry.source.book).toContain('仲尼弟子列传');
    expect(entry.source.quote).toContain('存鲁');
    expect(entry.stratagem).toEqual({ number: 3, set: 1 });
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.keywords).toContain('借力');
  });

  it('适龄化：这一计落在"借力"，故事与题目里不出现刀剑与死亡', () => {
    // 计名（借刀杀人）按方案保留；要守住的是画面与文案的落点：工地、杠杆、请人帮忙
    const text = JSON.stringify({
      moral: entry.moral,
      story: entry.story,
      keyMoment: entry.keyMoment,
      misconceptions: entry.misconceptions,
      quiz: entry.quiz,
      level,
    });
    for (const word of ['刀', '剑', '死', '血', '杀', '战场', '兵器']) {
      expect(text.includes(word)).toBe(false);
    }
  });
});
