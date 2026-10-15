import { ContentEntrySchema, getEntry } from '@chags/content/full';
import { siegeGain } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/weiwei-jiuzhao.json';
import rawDetail from '../../../packages/content/src/entries/weiwei-jiuzhao.game.json';
import { siegeLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('weiwei-jiuzhao') ?? ContentEntrySchema.parse(raw);
const level = siegeLevel(entry);

describe('围魏救赵 · 关卡数据', () => {
  it('正面在左下，两处要害在地图右上：粮道与大梁城门', () => {
    expect(level.front).toEqual({ x: 200, y: 980, radius: 96 });
    expect(level.vital.map((v) => v.id)).toEqual(['grain', 'gate']);
    expect(level.vital[0]).toMatchObject({ x: 560, y: 420, radius: 88, relief: 4 });
    expect(level.vital[1]).toMatchObject({ x: 300, y: 330, radius: 88, relief: 4 });
    expect(level.resistance).toBe(8);
    expect(level.goal).toBe(20);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('验算：不点要害要推 100 下，点完两处只要 20 下', () => {
    const straight = Math.ceil(level.goal / siegeGain(level.resistance));
    expect(straight).toBe(100);
    const left = Math.max(0, level.resistance - level.vital.reduce((sum, v) => sum + v.relief, 0));
    expect(left).toBe(0);
    expect(Math.ceil(level.goal / siegeGain(left))).toBe(20);
  });

  it('两幕故事，关键抉择点在第二幕', () => {
    expect(entry.story.length).toBe(2);
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).length).toBe(1);
  });

  it('迁移题与史源：孙膑那句"批亢捣虚，形格势禁"出自《史记》', () => {
    expect(entry.quiz.some((q) => q.kind === 'transfer')).toBe(true);
    expect(entry.source.book).toContain('史记');
    expect(entry.source.quote).toContain('批亢捣虚');
    expect(entry.stratagem).toEqual({ number: 2, set: 1 });
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.ageRange).toEqual([7, 11]);
  });
});
