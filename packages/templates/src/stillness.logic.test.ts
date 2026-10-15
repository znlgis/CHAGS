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

/* ---------------- 第 32 计 · 空城计（calm） ---------------- */

import { StillnessCalmSchema } from './schemas';
import {
  CALM_MIN_GAP_MS, CALM_MIN_WATCH_MS, calmPhaseAt, calmPhaseProgress, calmProgress,
  calmRemainingMs, calmSlotAt, calmStart, calmTick, calmTimeline, calmTotalMs, cleanWatches,
  effectiveCalmLevel, hitGate, isCalmDone, openGate, replayCalm, tapCalm,
} from './stillness.logic';

/** 空城计的三轮（与第 32 计的关卡一致）：他盯着 3400/3000/2600，移开目光 1800/1600/1600 */
const calm = StillnessCalmSchema.parse({
  mode: 'calm',
  gate: { x: 375, y: 820, radius: 150 },
  watches: [
    { id: 'w1', watchMs: 3400, gapMs: 1800 },
    { id: 'w2', watchMs: 3000, gapMs: 1600 },
    { id: 'w3', watchMs: 2600, gapMs: 1600 },
  ],
  needed: 2,
  doubtLine: '他朝营门多看了一眼……',
  leaveLine: '曹军退了。',
  hint: '他盯着的时候，一下都别动',
});

/** 城门大开之后的时间轴：三轮的"盯着"各从哪儿开始、"移开目光"各从哪儿开始 */
const WATCH_ENDS = [3400, 8200, 12400];
const WATCH_AT = [1500, 6000, 11000];
const GAP_AT = [4000, 9000, 13200];

describe('空城计 · 城门与时间轴', () => {
  it('城门没开之前没有时间轴：一直停在 gate（开一次就够）', () => {
    expect(calmPhaseAt(calm, calmStart(), 0)).toEqual({ watchId: null, index: 0, phase: 'gate' });
    expect(calmPhaseAt(calm, calmStart(), 99999).phase).toBe('gate');

    const opened = openGate(calm, calmStart());
    expect(opened.gateOpen).toBe(true);
    expect(openGate(calm, opened)).toBe(opened);
    expect(calmPhaseAt(calm, opened, 0)).toEqual({ watchId: 'w1', index: 0, phase: 'watch' });
  });

  it('一轮接一轮：盯着在前、移开目光在后，位置是累积出来的', () => {
    const slots = calmTimeline(calm);
    expect(slots.map((s) => s.watchStartMs)).toEqual([0, 5200, 9800]);
    expect(slots.map((s) => s.gapStartMs)).toEqual(WATCH_ENDS);
    expect(slots.map((s) => s.endMs)).toEqual([5200, 9800, 14000]);
    expect(calmTotalMs(calm)).toBe(14000);
  });

  it('盯着 = watch，移开目光 = gap，全走完 = done', () => {
    const state = openGate(calm, calmStart());
    expect(calmPhaseAt(calm, state, 0)).toEqual({ watchId: 'w1', index: 0, phase: 'watch' });
    expect(calmPhaseAt(calm, state, 3399).phase).toBe('watch');
    expect(calmPhaseAt(calm, state, 3400)).toEqual({ watchId: 'w1', index: 0, phase: 'gap' });
    expect(calmPhaseAt(calm, state, 5199).phase).toBe('gap');
    expect(calmPhaseAt(calm, state, 5200)).toEqual({ watchId: 'w2', index: 1, phase: 'watch' });
    expect(calmPhaseAt(calm, state, 12400)).toEqual({ watchId: 'w3', index: 2, phase: 'gap' });
    expect(calmPhaseAt(calm, state, 14000)).toEqual({
      watchId: null, index: 3, phase: 'done',
    });
    expect(calmSlotAt(calm, 14000)).toBeNull();
  });

  it('时钟只往一个方向走：t 比 0 还小，算在第一轮的开头', () => {
    const state = openGate(calm, calmStart());
    expect(calmPhaseAt(calm, state, -500)).toEqual({ watchId: 'w1', index: 0, phase: 'watch' });
    expect(tapCalm(calm, state, -500).slipWatchIds).toEqual(['w1']);
  });
});

describe('空城计 · 盯着的时候点一下就白忍一轮', () => {
  it('盯着的时候点一下：记一笔 slip，这一轮就不算"忍住"了（零惩罚）', () => {
    let state = openGate(calm, calmStart());
    state = tapCalm(calm, state, WATCH_AT[0]!);
    expect(state.slips).toBe(1);
    expect(state.slipWatchIds).toEqual(['w1']);

    // 这一轮看完：白忍了 —— 忍住的轮数一步都不涨，但账留着、人也没被怎么样
    state = calmTick(calm, state, WATCH_ENDS[0]!);
    expect(state.settled).toBe(1);
    expect(cleanWatches(state)).toBe(0);
    expect(isCalmDone(calm, state)).toBe(false);
    expect(calmProgress(calm, state)).toBe(0);

    // 下一轮忍住 —— 还是有机会：第二、第三轮各攒下一轮
    state = calmTick(calm, state, WATCH_ENDS[1]!);
    expect(cleanWatches(state)).toBe(1);
    expect(isCalmDone(calm, state)).toBe(false);
    state = calmTick(calm, state, WATCH_ENDS[2]!);
    expect(cleanWatches(state)).toBe(2);
    expect(isCalmDone(calm, state)).toBe(true);
  });

  it('同一轮里连点：只记一笔（这一轮反正白忍了，账不用记花）', () => {
    let state = openGate(calm, calmStart());
    state = tapCalm(calm, state, 200);
    state = tapCalm(calm, state, 900);
    state = tapCalm(calm, state, 3300);
    expect(state.slips).toBe(1);
    expect(state.slipWatchIds).toEqual(['w1']);
  });

  it('他移开目光的时候点一下：什么也不记 —— 他没看见', () => {
    let state = openGate(calm, calmStart());
    state = tapCalm(calm, state, GAP_AT[0]!);
    expect(state.slips).toBe(0);
    expect(state.slipWatchIds).toEqual([]);
    // 空档里点过了，这一轮照样算忍住
    state = calmTick(calm, state, 5200);
    expect(cleanWatches(state)).toBe(1);
  });

  it('城门还没开的时候点：什么也不记（还没轮到"忍住"）', () => {
    expect(tapCalm(calm, calmStart(), 500)).toEqual(calmStart());
  });
});

describe('空城计 · 忍住 needed 轮他就退', () => {
  it('一下都没动：第一轮看完记一次，第二轮看完他就退了', () => {
    let state = openGate(calm, calmStart());
    expect(cleanWatches(calmTick(calm, state, 0))).toBe(0);
    state = calmTick(calm, state, WATCH_ENDS[0]!);
    expect(cleanWatches(state)).toBe(1);
    expect(isCalmDone(calm, state)).toBe(false);
    state = calmTick(calm, state, WATCH_ENDS[1]!);
    expect(cleanWatches(state)).toBe(2);
    expect(isCalmDone(calm, state)).toBe(true);
    expect(calmProgress(calm, state)).toBe(1);
    // 他退了：再喂墙钟也不会多算一笔
    expect(calmTick(calm, state, 14000)).toBe(state);
  });

  it('一口气喂到底：只攒到 needed 轮就停（不用把三轮都看完）', () => {
    const state = calmTick(calm, openGate(calm, calmStart()), 99999);
    expect(cleanWatches(state)).toBe(calm.needed);
    expect(state.settled).toBe(2);
    expect(isCalmDone(calm, state)).toBe(true);
  });

  it('还没走到这一轮的 gapStart：一轮都不算（什么也没变就原样返回）', () => {
    let state = openGate(calm, calmStart());
    state = calmTick(calm, state, 3399);
    expect(state.settled).toBe(0);
    expect(calmTick(calm, state, 0)).toBe(state);
  });

  it('三轮全看完还没忍够：他再从头盯一遍，忍住的轮数留着（零惩罚，也不会卡死）', () => {
    // 第一、二轮动了，第三轮忍住 → 只攒下 1 轮
    let state = openGate(calm, calmStart());
    state = tapCalm(calm, state, WATCH_AT[0]!);
    state = tapCalm(calm, state, WATCH_AT[1]!);
    state = calmTick(calm, state, 14000);
    expect(cleanWatches(state)).toBe(1);
    expect(isCalmDone(calm, state)).toBe(false);
    expect(calmPhaseAt(calm, state, 14000).phase).toBe('done');

    // 重开一遍：slips 那几笔账留着，这一遍的轮次重新数
    const again = replayCalm(state);
    expect(again.endured).toBe(1);
    expect(again.slips).toBe(2);
    expect(again.slipWatchIds).toEqual([]);
    expect(again.settled).toBe(0);

    const next = calmTick(calm, again, WATCH_ENDS[0]!);
    expect(cleanWatches(next)).toBe(2);
    expect(isCalmDone(calm, next)).toBe(true);
  });
});

describe('空城计 · 手感与边界', () => {
  it('手指落在城门上，宽容度让小朋友不用对准', () => {
    expect(hitGate(375, 820, calm)).toBe(true);
    expect(hitGate(375, 820, calm, 60)).toBe(true);
    expect(hitGate(375, 820 + 150 + 61, calm, 60)).toBe(false);
    expect(hitGate(100, 820, calm)).toBe(false);
  });

  it('剩余时间与分段进度：从"他盯着"走到"他移开目光"，再走到整局结束', () => {
    const state = openGate(calm, calmStart());
    expect(calmRemainingMs(calm, state, 0)).toBe(3400);
    expect(calmRemainingMs(calm, state, 3400)).toBe(1800);
    expect(calmRemainingMs(calm, state, 14000)).toBe(0);
    expect(calmRemainingMs(calm, calmStart(), 100)).toBe(0);

    expect(calmPhaseProgress(calm, state, 0)).toBe(0);
    expect(calmPhaseProgress(calm, state, 1700)).toBeCloseTo(0.5, 2);
    expect(calmPhaseProgress(calm, state, 4300)).toBeCloseTo(0.5, 2);
    expect(calmPhaseProgress(calm, state, 14000)).toBe(1);
    expect(calmPhaseProgress(calm, calmStart(), 100)).toBe(0);
  });

  it('无头验证把两段都压成几分之一，但压过之后仍然过 schema、照样走得完', () => {
    const fast = effectiveCalmLevel(calm, true, 5);
    // 3400/5 = 680 太短，落在地板上；schema 也要求 watchMs >= 1200
    expect(fast.watches.map((w) => w.watchMs)).toEqual([1200, 1200, 1200]);
    expect(fast.watches.map((w) => w.gapMs)).toEqual([360, 320, 320]);
    expect(fast.watches.every((w) => w.watchMs >= CALM_MIN_WATCH_MS)).toBe(true);
    expect(fast.watches.every((w) => w.gapMs >= CALM_MIN_GAP_MS)).toBe(true);
    expect(StillnessCalmSchema.parse(fast)).toBeTruthy();
    expect(effectiveCalmLevel(calm, false, 5)).toBe(calm);

    // 压过之后照样走得完：第一轮看完、第二轮看完，他就退了
    let state = openGate(fast, calmStart());
    state = calmTick(fast, state, 1200);
    expect(isCalmDone(fast, state)).toBe(false);
    state = calmTick(fast, state, 1200 + 360 + 1200);
    expect(isCalmDone(fast, state)).toBe(true);
  });
});

describe('空城计 · schema', () => {
  it('挡住"要忍住的轮数比试探还多"', () => {
    expect(() => StillnessCalmSchema.parse({ ...calm, needed: 4 })).toThrow();
  });

  it('挡住"盯着不到 1.2 秒"（那就不算一次忍住）', () => {
    expect(() =>
      StillnessCalmSchema.parse({
        ...calm,
        watches: [
          { id: 'w1', watchMs: 900, gapMs: 1600 },
          { id: 'w2', watchMs: 3000, gapMs: 1600 },
        ],
      }),
    ).toThrow();
  });

  it('挡住重复的轮次 id', () => {
    expect(() =>
      StillnessCalmSchema.parse({
        ...calm,
        watches: [
          { id: 'w1', watchMs: 2600, gapMs: 1800 },
          { id: 'w1', watchMs: 2400, gapMs: 1600 },
        ],
      }),
    ).toThrow();
  });
});
