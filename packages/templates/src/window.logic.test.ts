import { describe, expect, it } from 'vitest';
import { WindowLevelSchema } from './schemas';
import {
  closeWindow, cycleIndexAt, doneCount, effectiveCycle, isWindowDone, jobAt, jobProgress,
  jobWork, nextJob, nextWindowInMs, phaseAt, phaseProgress, phaseRemainingMs, tapAt, tapJob,
  tapsNeeded, windowStart,
} from './window.logic';

/** 趁火打劫的水寨：稳 4.2 秒，乱 3 秒，三件活儿（与内容 JSON 里的一模一样） */
const level = WindowLevelSchema.parse({
  mode: 'fire',
  cycle: { calmMs: 4200, windowMs: 3000 },
  jobs: [
    { id: 'boat', x: 240, y: 1020, radius: 90, workMs: 2600 },
    { id: 'grain', x: 430, y: 940, radius: 90, workMs: 2200 },
    { id: 'gate', x: 620, y: 1020, radius: 90, workMs: 2000 },
  ],
  workTapMs: 340,
  goal: 3,
  hint: '等巡逻的灯走远',
});

/** 在窗口里把一件活儿点完 */
function finish(jobId: string, state = windowStart()) {
  const job = level.jobs.find((item) => item.id === jobId)!;
  let next = state;
  for (let i = 0; i < tapsNeeded(job, level); i += 1) next = tapJob(next, level, jobId);
  return next;
}

describe('稳与乱的周期', () => {
  it('先稳一段，快开窗时先有征兆，然后才是窗口', () => {
    expect(phaseAt(level, 0)).toBe('calm');
    expect(phaseAt(level, 3499)).toBe('calm');
    expect(phaseAt(level, 3500)).toBe('warn');
    expect(phaseAt(level, 4199)).toBe('warn');
    expect(phaseAt(level, 4200)).toBe('window');
    expect(phaseAt(level, 7199)).toBe('window');
  });

  it('周期一轮一轮地摆：下一个周期从头再来', () => {
    expect(phaseAt(level, 7200)).toBe('calm');
    expect(cycleIndexAt(level, 7199)).toBe(0);
    expect(cycleIndexAt(level, 7200)).toBe(1);
    expect(phaseAt(level, 11400)).toBe('window');
    expect(phaseAt(level, 14400)).toBe('calm');
  });

  it('窗口快要开的时候，钟与进度都说得清', () => {
    expect(phaseRemainingMs(level, 4000)).toBe(200);
    expect(phaseRemainingMs(level, 5000)).toBe(2200);
    expect(nextWindowInMs(level, 4000)).toBe(200);
    expect(nextWindowInMs(level, 5000)).toBe(0);
    expect(phaseProgress(level, 4600)).toBeCloseTo(400 / 3000, 3);
  });
});

describe('什么时候才干得动活儿', () => {
  it('calm 期点 job 无效 —— 靠近就被赶回来', () => {
    const state = windowStart();
    expect(tapAt(state, level, 'boat', 1000)).toBe(state);
    expect(jobWork(tapAt(state, level, 'boat', 1000), level, 'boat')).toBe(0);
  });

  it('征兆期也还没开门：点了同样不算', () => {
    const state = windowStart();
    expect(tapAt(state, level, 'boat', 3600)).toBe(state);
  });

  it('窗口里连点能把一件活儿干完', () => {
    let state = windowStart();
    for (let i = 0; i < 7; i += 1) state = tapAt(state, level, 'boat', 4300);
    expect(jobProgress(state, level, 'boat')).toBeLessThan(1);
    expect(doneCount(state)).toBe(0);
    const last = tapAt(state, level, 'boat', 4300);
    expect(doneCount(last)).toBe(1);
    expect(jobWork(last, level, 'boat')).toBe(2600);
    expect(jobProgress(last, level, 'boat')).toBe(1);
  });

  it('点一下只推进 workTapMs，点够了才算干完', () => {
    const state = tapJob(windowStart(), level, 'boat');
    expect(jobWork(state, level, 'boat')).toBe(340);
    expect(tapsNeeded(level.jobs[0]!, level)).toBe(8);
    expect(tapsNeeded(level.jobs[1]!, level)).toBe(7);
    expect(tapsNeeded(level.jobs[2]!, level)).toBe(6);
  });

  it('干完的活儿再点也不会变，进度不会溢出', () => {
    const state = finish('gate');
    expect(tapJob(state, level, 'gate')).toBe(state);
    expect(jobWork(state, level, 'gate')).toBe(2000);
  });
});

describe('窗口关上：没干完的清零（零惩罚）', () => {
  it('半截的活儿一关窗就归零，下个窗口从头干', () => {
    let state = windowStart();
    for (let i = 0; i < 3; i += 1) state = tapAt(state, level, 'boat', 4300);
    expect(jobWork(state, level, 'boat')).toBe(1020);

    const closed = closeWindow(state, level);
    expect(jobWork(closed, level, 'boat')).toBe(0);
    expect(closed.done).toEqual([]);
    expect(closed.resets).toBe(1);
  });

  it('干完的活儿不会被窗口关上抹掉', () => {
    let state = finish('grain');
    state = tapJob(state, level, 'boat');
    const closed = closeWindow(state, level);
    expect(closed.done).toEqual(['grain']);
    expect(jobWork(closed, level, 'grain')).toBe(2200);
    expect(jobWork(closed, level, 'boat')).toBe(0);
    expect(closed.resets).toBe(1);
  });

  it('什么也没干的时候关窗，不算白跑一趟', () => {
    const closed = closeWindow(windowStart(), level);
    expect(closed.resets).toBe(0);
  });

  it('下个窗口接着干，两趟之间干完一件也留得住', () => {
    let state = finish('boat');
    state = closeWindow(state, level);
    state = finish('gate', state);
    expect(state.done).toEqual(['boat', 'gate']);
    expect(doneCount(state)).toBe(2);
  });
});

describe('干完 goal 件就成功', () => {
  it('三件都干完才算成功', () => {
    let state = finish('boat');
    expect(isWindowDone(level, state)).toBe(false);
    state = finish('grain', state);
    expect(isWindowDone(level, state)).toBe(false);
    state = finish('gate', state);
    expect(isWindowDone(level, state)).toBe(true);
  });

  it('goal 比活儿少时，干完 goal 件就成功', () => {
    const two = WindowLevelSchema.parse({ ...level, goal: 2 });
    const state = finish('boat', finish('grain'));
    expect(isWindowDone(two, state)).toBe(true);
  });

  it('下一件还没干完的活儿总是排在最前面的那件', () => {
    expect(nextJob(level, windowStart())?.id).toBe('boat');
    expect(nextJob(level, finish('boat'))?.id).toBe('grain');
    expect(nextJob(level, finish('gate', finish('grain', finish('boat'))))).toBeUndefined();
  });
});

describe('手感与边界', () => {
  it('手指落在最近的活儿上，宽容度让小朋友不用对准', () => {
    expect(jobAt(240, 1020, level)?.id).toBe('boat');
    expect(jobAt(250, 1100, level)?.id).toBe('boat');
    expect(jobAt(375, 700, level)).toBeNull();
    expect(jobAt(375, 700, level, 400)?.id).toBe('grain');
  });

  it('无头验证把周期压成几分之一，但至少留得下点几下', () => {
    const fast = effectiveCycle(level, true, 3);
    expect(fast.cycle).toEqual({ calmMs: 1400, windowMs: 1000 });
    expect(phaseAt(fast, 1400)).toBe('window');
    // 压过之后的窗口装不下一整件活儿（2600 > 1000）—— 这是**刻意的**：
    // 无头验证里连点比人快得多（55ms 一下），所以场景不会拿压缩过的关卡去过 schema。
    expect(() => WindowLevelSchema.parse(fast)).toThrow();
    expect(effectiveCycle(level, false, 3)).toBe(level);
    const tiny = effectiveCycle({ ...level, cycle: { calmMs: 300, windowMs: 300 } }, true, 30);
    expect(tiny.cycle).toEqual({ calmMs: 200, windowMs: 200 });
  });
});

describe('schema', () => {
  it('挡住"一个窗口里根本干不完的活儿"', () => {
    expect(() =>
      WindowLevelSchema.parse({
        ...level,
        jobs: [{ id: 'boat', x: 0, y: 0, radius: 90, workMs: 9000 }],
      }),
    ).toThrow();
  });

  it('挡住"点一下就用掉整个窗口"', () => {
    expect(() => WindowLevelSchema.parse({ ...level, workTapMs: 3000 })).toThrow();
  });

  it('挡住"要干的活儿比摆出来的还多"', () => {
    expect(() => WindowLevelSchema.parse({ ...level, goal: 4 })).toThrow();
  });

  it('挡住重复的活儿 id', () => {
    expect(() =>
      WindowLevelSchema.parse({
        ...level,
        jobs: [level.jobs[0], { ...level.jobs[1], id: 'boat' }],
      }),
    ).toThrow();
  });
});
