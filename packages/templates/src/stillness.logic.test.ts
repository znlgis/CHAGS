import { describe, expect, it } from 'vitest';
import { StillnessLevelSchema } from './schemas';
import {
  applyStrike, beatMarks, beatProgress, canStrikeAt, correctBeat, effectiveLevel, hitAction,
  isStillnessDone, phaseAt, remainingInBeatMs, slotAt, stillnessStart, strikeAt, timeline,
  totalMs,
} from './stillness.logic';

/** 以逸待劳的三通鼓（与内容 JSON 里的一模一样） */
const level = StillnessLevelSchema.parse({
  mode: 'bide',
  beats: [
    { id: 'd1', drumMs: 2600, windowMs: 1600, correct: false },
    { id: 'd2', drumMs: 2400, windowMs: 1400, correct: false },
    { id: 'd3', drumMs: 2000, windowMs: 2600, correct: true },
  ],
  action: { x: 375, y: 1150, radius: 110 },
  hint: '再等一等',
});

describe('三通鼓的时间轴', () => {
  it('一通接一通：鼓响在前，窗口在后，位置是累积出来的', () => {
    const slots = timeline(level);
    expect(slots.map((s) => s.drumStartMs)).toEqual([0, 4200, 8000]);
    expect(slots.map((s) => s.windowStartMs)).toEqual([2600, 6600, 10000]);
    expect(totalMs(level)).toBe(12600);
  });

  it('鼓响 = drum，鼓停 = window，全都敲完 = done', () => {
    expect(phaseAt(level, 0)).toEqual({ beatId: 'd1', phase: 'drum' });
    expect(phaseAt(level, 2599).phase).toBe('drum');
    expect(phaseAt(level, 2600)).toEqual({ beatId: 'd1', phase: 'window' });
    expect(phaseAt(level, 4199)).toEqual({ beatId: 'd1', phase: 'window' });
    expect(phaseAt(level, 4200)).toEqual({ beatId: 'd2', phase: 'drum' });
    expect(phaseAt(level, 8000)).toEqual({ beatId: 'd3', phase: 'drum' });
    expect(phaseAt(level, 10000)).toEqual({ beatId: 'd3', phase: 'window' });
  });

  it('时间超过所有 beat（窗口关上）之后 phase 是 done', () => {
    expect(phaseAt(level, 12600)).toEqual({ beatId: null, phase: 'done' });
    expect(phaseAt(level, 99999).phase).toBe('done');
    expect(slotAt(level, 12600)).toBeNull();
  });

  it('三面鼓一盏一盏地亮，已经过去的记 passed', () => {
    expect(beatMarks(level, 1000)).toEqual(['drum', 'rest', 'rest']);
    expect(beatMarks(level, 7000)).toEqual(['passed', 'window', 'rest']);
    expect(beatMarks(level, 11000)).toEqual(['passed', 'passed', 'window']);
  });
});

describe('什么时候出手', () => {
  it('第一通鼓响着的时候出击 = 白费力气', () => {
    expect(strikeAt(level, 1200)).toBe('early');
  });

  it('第二通鼓的窗口里出击仍然 = 白费力气（他还有劲）', () => {
    expect(strikeAt(level, 6600)).toBe('early');
    expect(strikeAt(level, 7900)).toBe('early');
  });

  it('第三通鼓的窗口里出击 = hit', () => {
    expect(strikeAt(level, 10000)).toBe('hit');
    expect(strikeAt(level, 12599)).toBe('hit');
    expect(canStrikeAt(level, 11000)).toBe(true);
  });

  it('第三通鼓还在响的时候出手还是白费力气 —— 再而衰，三而竭', () => {
    expect(strikeAt(level, 9999)).toBe('early');
  });

  it('鼓全敲完之后出击不再算 hit', () => {
    expect(strikeAt(level, 12600)).toBe('idle');
    expect(strikeAt(level, 60000)).toBe('idle');
    expect(canStrikeAt(level, 12600)).toBe(false);
  });

  it('只有最后一通是该出手的那一通', () => {
    expect(correctBeat(level)?.id).toBe('d3');
  });
});

describe('白费力气不惩罚，等到了才算数', () => {
  it('打在窗口里才算做完', () => {
    const state = applyStrike(level, stillnessStart(), 10800);
    expect(isStillnessDone(state)).toBe(true);
    expect(state.early).toBe(0);
  });

  it('白鼓记一笔，但状态还能接着用（零惩罚重来）', () => {
    const first = applyStrike(level, stillnessStart(), 1200);
    expect(isStillnessDone(first)).toBe(false);
    expect(first.early).toBe(1);
    expect(first.earlyBeatIds).toEqual(['d1']);

    const second = applyStrike(level, first, 7000);
    expect(isStillnessDone(second)).toBe(false);
    expect(second.early).toBe(2);
    expect(second.earlyBeatIds).toEqual(['d1', 'd2']);

    // 白了两回之后，这一轮仍然能打成
    const third = applyStrike(level, second, 11000);
    expect(isStillnessDone(third)).toBe(true);
    expect(third.early).toBe(2);
  });

  it('一轮走完之后再出手什么也不记（要重来就重开一轮）', () => {
    const state = applyStrike(level, stillnessStart(), 13000);
    expect(isStillnessDone(state)).toBe(false);
    expect(state.early).toBe(0);
  });

  it('已经打中了就不再是"还没做"', () => {
    const state = applyStrike(level, stillnessStart(), 11000);
    expect(isStillnessDone(state)).toBe(true);
    expect(isStillnessDone(stillnessStart())).toBe(false);
  });
});

describe('手感与边界', () => {
  it('手指落在出击按钮上，宽容度让小朋友不用对准', () => {
    expect(hitAction(375, 1150, level)).toBe(true);
    expect(hitAction(375, 1290, level)).toBe(false);
    expect(hitAction(375, 1290, level, 60)).toBe(true);
    expect(hitAction(100, 1150, level)).toBe(false);
  });

  it('鼓面波纹的相位：一通鼓从头走到尾', () => {
    expect(beatProgress(level, 0)).toBe(0);
    expect(beatProgress(level, 2100)).toBeCloseTo(0.5, 2);
    expect(beatProgress(level, 12600)).toBe(1);
    expect(remainingInBeatMs(level, 0)).toBe(4200);
    expect(remainingInBeatMs(level, 12600)).toBe(0);
  });

  it('无头验证把三通鼓压成几分之一，但恰好一个 correct 不变', () => {
    const fast = effectiveLevel(level, true, 5);
    expect(fast.beats.map((b) => b.drumMs)).toEqual([520, 480, 400]);
    expect(fast.beats.map((b) => b.windowMs)).toEqual([320, 280, 520]);
    expect(fast.beats.filter((b) => b.correct).map((b) => b.id)).toEqual(['d3']);
    // 压过之后仍然过 schema，而且"该出手"的那一通仍在最后一通
    expect(() => StillnessLevelSchema.parse(fast)).not.toThrow();
    expect(effectiveLevel(level, false, 5)).toBe(level);
  });
});

describe('schema', () => {
  it('挡住"多一个正确的窗口"', () => {
    expect(() =>
      StillnessLevelSchema.parse({
        ...level,
        beats: level.beats.map((b) => ({ ...b, correct: true })),
      }),
    ).toThrow();
  });

  it('挡住"该出手的不是最后一通"', () => {
    expect(() =>
      StillnessLevelSchema.parse({
        ...level,
        beats: [
          { id: 'd1', drumMs: 2600, windowMs: 1600, correct: true },
          { id: 'd2', drumMs: 2400, windowMs: 1400, correct: false },
          { id: 'd3', drumMs: 2000, windowMs: 2600, correct: false },
        ],
      }),
    ).toThrow();
  });

  it('挡住重复的鼓 id', () => {
    expect(() =>
      StillnessLevelSchema.parse({
        ...level,
        beats: [
          { id: 'd1', drumMs: 2600, windowMs: 1600, correct: false },
          { id: 'd1', drumMs: 2400, windowMs: 1400, correct: true },
        ],
      }),
    ).toThrow();
  });
});
