import { getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { stillnessLevel } from './logic';

/** 把关卡数据里的三通鼓摊成时间轴 —— 判定本身在模板的 stillness.logic 里有单测 */
function timelineOf(level: ReturnType<typeof stillnessLevel>): {
  id: string;
  correct: boolean;
  drumStart: number;
  windowStart: number;
  end: number;
}[] {
  let cursor = 0;
  return level.beats.map((beat) => {
    const drumStart = cursor;
    const windowStart = drumStart + beat.drumMs;
    cursor = windowStart + beat.windowMs;
    return { id: beat.id, correct: beat.correct, drumStart, windowStart, end: cursor };
  });
}

describe('以逸待劳 · 关卡数据', () => {
  const raw = getEntry('yiyi-dailao');
  const level = stillnessLevel(raw!);

  it('三通鼓：前两通是白鼓，最后一通才是该出手的那一通', () => {
    expect(level.mode).toBe('bide');
    expect(level.beats.map((b) => b.id)).toEqual(['d1', 'd2', 'd3']);
    expect(level.beats.map((b) => b.correct)).toEqual([false, false, true]);
  });

  it('三通鼓按顺序响：一鼓作气、再而衰、三而竭 —— 该出手的那一通窗口最长', () => {
    const slots = timelineOf(level);
    expect(slots.map((s) => [s.drumStart, s.windowStart, s.end])).toEqual([
      [0, 2600, 4200],
      [4200, 6600, 8000],
      [8000, 10000, 12600],
    ]);
    expect(level.beats.map((b) => b.drumMs)).toEqual([2600, 2400, 2000]);
    expect(level.beats.at(-1)!.windowMs).toBe(2600);
  });

  it('出击按钮在关卡给的位置上：375 / 1150，够大够好点', () => {
    expect(level.action).toEqual({ x: 375, y: 1150, radius: 110 });
  });

  it('三通鼓都在鼓响之后才开窗口 —— 鼓响时出手一定是白费力气', () => {
    for (const slot of timelineOf(level)) {
      expect(slot.windowStart).toBeGreaterThan(slot.drumStart);
      expect(slot.end).toBeGreaterThan(slot.windowStart);
    }
  });

  it('故事两幕：先听见对面的鼓，再看见曹刿按住他的手', () => {
    expect(raw?.story.length).toBe(2);
    expect(raw?.keyMoment.beatId).toBe('s1');
    expect(raw?.source.book).toContain('左传');
    expect(raw?.source.quote).toContain('一鼓作气');
  });

  it('三十六计：第 4 计 · 胜战计（第 1 套）', () => {
    expect(raw?.group).toBe('stratagem');
    expect(raw?.kind).toBe('strategy');
    expect(raw?.stratagem).toEqual({ number: 4, set: 1 });
    expect(raw?.ageRange).toEqual([7, 11]);
  });

  it('关键抉择点恰好一个"等"：其余选项都有自己的说法', () => {
    const options = raw!.keyMoment.options;
    expect(options.filter((o) => o.isCanonical).length).toBe(1);
    expect(options.find((o) => o.isCanonical)?.text).toContain('等');
    expect(options.length).toBe(3);
  });

  it('复习题：记忆题问第几通鼓，迁移题问拔河什么时候使劲', () => {
    const quiz = raw!.quiz;
    expect(quiz.some((q) => q.kind === 'transfer')).toBe(true);
    expect(quiz[0]!.question).toContain('第几通');
    expect(quiz.find((q) => q.kind === 'transfer')?.question).toContain('拔河');
  });
});
