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


/* ---------------- 第 27 计 · 假痴不癫（feign） ---------------- */

import { StillnessFeignSchema } from './schemas';
import {
  FEIGN_MIN_PHASE_MS, effectiveFeignLevel, feignCanAct, feignPhaseAt, feignPhaseProgress,
  feignProgress, feignRemainingMs, feignSlotAt, feignStart, feignTimeline, feignTotalMs,
  hitFeignAction, isFeignDone, tapActionFeign,
} from './stillness.logic';

/** 假痴不癫的三次试探（与第 27 计的关卡一致）：试探 2600/2400/2200，空档 1800/1600/1600 */
const feign = StillnessFeignSchema.parse({
  mode: 'feign',
  tests: [
    { id: 't1', testMs: 2600, gapMs: 1800 },
    { id: 't2', testMs: 2400, gapMs: 1600 },
    { id: 't3', testMs: 2200, gapMs: 1600 },
  ],
  action: { x: 375, y: 1140, radius: 130 },
  steps: 3,
  hint: '他盯着的时候别动，走开再动手',
});

describe('假痴不癫 · 试探与空档的时间轴', () => {
  it('一次试探接着一个空档：位置是累积出来的', () => {
    const slots = feignTimeline(feign);
    expect(slots.map((s) => s.testStartMs)).toEqual([0, 4400, 8400]);
    expect(slots.map((s) => s.gapStartMs)).toEqual([2600, 6800, 10600]);
    expect(slots.map((s) => s.endMs)).toEqual([4400, 8400, 12200]);
    expect(feignTotalMs(feign)).toBe(12200);
  });

  it('试探期 = test，紧接着的空档 = gap，全走完 = done', () => {
    expect(feignPhaseAt(feign, 0)).toEqual({ testId: 't1', phase: 'test' });
    expect(feignPhaseAt(feign, 2599)).toEqual({ testId: 't1', phase: 'test' });
    expect(feignPhaseAt(feign, 2600)).toEqual({ testId: 't1', phase: 'gap' });
    expect(feignPhaseAt(feign, 4399)).toEqual({ testId: 't1', phase: 'gap' });
    expect(feignPhaseAt(feign, 4400)).toEqual({ testId: 't2', phase: 'test' });
    expect(feignPhaseAt(feign, 6800)).toEqual({ testId: 't2', phase: 'gap' });
    expect(feignPhaseAt(feign, 8400)).toEqual({ testId: 't3', phase: 'test' });
    expect(feignPhaseAt(feign, 10600)).toEqual({ testId: 't3', phase: 'gap' });
    expect(feignPhaseAt(feign, 12200)).toEqual({ testId: null, phase: 'done' });
    expect(feignPhaseAt(feign, 99999).phase).toBe('done');
    expect(feignSlotAt(feign, 12200)).toBeNull();
  });

  it('只有空档里才是"可以动手"的时刻', () => {
    expect(feignCanAct(feign, 1200)).toBe(false);
    expect(feignCanAct(feign, 2600)).toBe(true);
    expect(feignCanAct(feign, 10600)).toBe(true);
    expect(feignCanAct(feign, 12200)).toBe(false);
  });
});

describe('假痴不癫 · 试探期点只记 slip，空档期点才推进', () => {
  it('试探期点一下：slip 记一笔，进度一步都不动（零惩罚）', () => {
    let state = feignStart();
    state = tapActionFeign(feign, state, 300);
    expect(state.slips).toBe(1);
    expect(state.slipTestIds).toEqual(['t1']);
    expect(state.progress).toBe(0);
    expect(isFeignDone(state)).toBe(false);
    expect(feignProgress(feign, state)).toBe(0);

    // 试探期连点三下：三笔账，进度仍然不动 —— 不扣星、不结束、不锁操作
    state = tapActionFeign(feign, state, 900);
    state = tapActionFeign(feign, state, 2500);
    expect(state.slips).toBe(3);
    expect(state.slipTestIds).toEqual(['t1', 't1', 't1']);
    expect(state.progress).toBe(0);
    expect(isFeignDone(state)).toBe(false);
  });

  it('空档期点一下：推进一步；三次试探都忍住，三次空档正好推满', () => {
    let state = feignStart();
    expect(feignPhaseAt(feign, 2700).phase).toBe('gap');
    state = tapActionFeign(feign, state, 2700);
    expect(state.progress).toBe(1);
    expect(isFeignDone(state)).toBe(false);

    // 第二次试探：没忍住，点了一下 —— 只记 slip，进度不退
    state = tapActionFeign(feign, state, 5000);
    expect(state.slips).toBe(1);
    expect(state.progress).toBe(1);

    state = tapActionFeign(feign, state, 7000);
    expect(state.progress).toBe(2);
    state = tapActionFeign(feign, state, 11000);
    expect(state.progress).toBe(3);
    expect(isFeignDone(state)).toBe(true);
    expect(feignProgress(feign, state)).toBe(1);
  });

  it('空档里连点：进度封顶在 steps，不会推过头', () => {
    let state = feignStart();
    for (let i = 0; i < 6; i += 1) state = tapActionFeign(feign, state, 3000);
    expect(state.progress).toBe(feign.steps);
    expect(isFeignDone(state)).toBe(true);
    expect(feignProgress(feign, state)).toBe(1);
  });

  it('已经成了之后再点：原样返回（不会把账算花）', () => {
    let state = feignStart();
    state = tapActionFeign(feign, state, 2700);
    state = tapActionFeign(feign, state, 2700);
    state = tapActionFeign(feign, state, 2700);
    expect(isFeignDone(state)).toBe(true);
    expect(tapActionFeign(feign, state, 3000)).toBe(state);
    expect(tapActionFeign(feign, state, 5000)).toBe(state);
  });

  it('一轮走完之后再出手什么也不记（要重开一轮）', () => {
    const state = tapActionFeign(feign, feignStart(), 13000);
    expect(state.progress).toBe(0);
    expect(state.slips).toBe(0);
    expect(isFeignDone(state)).toBe(false);
  });

  it('时钟只往一个方向走：t 比 0 还小，算在第一次试探的开头', () => {
    expect(feignPhaseAt(feign, -500)).toEqual({ testId: 't1', phase: 'test' });
    const state = tapActionFeign(feign, feignStart(), -500);
    expect(state.slips).toBe(1);
    expect(state.progress).toBe(0);
  });
});

describe('假痴不癫 · 手感与边界', () => {
  it('手指落在"悄悄动手"的地方上，宽容度让小朋友不用对准', () => {
    expect(hitFeignAction(375, 1140, feign)).toBe(true);
    expect(hitFeignAction(375, 1320, feign)).toBe(false);
    expect(hitFeignAction(375, 1320, feign, 60)).toBe(true);
    expect(hitFeignAction(100, 1140, feign)).toBe(false);
  });

  it('剩余时间与分段进度：从试探走到空档，再走到整局结束', () => {
    expect(feignRemainingMs(feign, 0)).toBe(4400);
    expect(feignRemainingMs(feign, 4300)).toBe(100);
    expect(feignRemainingMs(feign, 12200)).toBe(0);
    expect(feignPhaseProgress(feign, 1300)).toBeCloseTo(0.5, 2);
    expect(feignPhaseProgress(feign, 3500)).toBeCloseTo(0.5, 2);
    expect(feignPhaseProgress(feign, 12200)).toBe(1);
  });

  it('无头验证把试探与空档都压成几分之一，但每一段都留得下点得到', () => {
    const fast = effectiveFeignLevel(feign, true, 5);
    expect(fast.tests.map((t) => t.testMs)).toEqual([520, 480, 440]);
    expect(fast.tests.map((t) => t.gapMs)).toEqual([360, 320, 320]);
    expect(StillnessFeignSchema.parse(fast)).toBeTruthy();
    expect(fast.tests.every((t) => t.gapMs >= FEIGN_MIN_PHASE_MS)).toBe(true);
    expect(effectiveFeignLevel(feign, false, 5)).toBe(feign);
    // 压过之后照样走得完：三次空档各推一步
    let state = feignStart();
    for (const t of [600, 1400, 2200]) state = tapActionFeign(fast, state, t);
    expect(isFeignDone(state)).toBe(true);
  });

  it('schema 挡住重复的试探 id', () => {
    expect(() =>
      StillnessFeignSchema.parse({
        ...feign,
        tests: [
          { id: 't1', testMs: 2600, gapMs: 1800 },
          { id: 't1', testMs: 2400, gapMs: 1600 },
        ],
      }),
    ).toThrow();
  });
});
