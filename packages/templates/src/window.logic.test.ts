import { describe, expect, it } from 'vitest';
import { WindowLevelSchema } from './schemas';
import {
  MURK_MAX, closeWindow, currentJob, cycleIndexAt, doneCount, effectiveCycle, isJobDone, isMuddy,
  isTravelOver, isWindowDone, jobAt, jobProgress, jobWork, muddyLeftMs, murkAt, nextJob,
  nextWindowInMs, phaseAt, phaseProgress, phaseRemainingMs, restartTravel, stirAt, stirStart,
  tapAt, tapJob, tapsNeeded, travelLeftMs, windowStart,
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
/* ---------------- glimpse（顺手牵羊）：这一轮只路过一件机会 ---------------- */

/** 顺手牵羊的路：稳 3 秒、窗口 2.6 秒，一趟 45 秒，三件机会轮着路过 */
const glimpse = WindowLevelSchema.parse({
  mode: 'glimpse',
  travelMs: 45000,
  cycle: { calmMs: 3000, windowMs: 2600 },
  jobs: [
    { id: 'sheep', x: 105, y: 960, radius: 92, workMs: 1500 },
    { id: 'wood', x: 510, y: 804, radius: 92, workMs: 1500 },
    { id: 'skin', x: 510, y: 1116, radius: 92, workMs: 1400 },
  ],
  workTapMs: 340,
  goal: 3,
  hint: '机会路过就抓住',
});

/** 在一轮的窗口里把这件机会抓住（每一轮的那件都不一样，所以 t 要落在它自己的窗口里） */
function grab(jobId: string, t: number, state = windowStart()) {
  let next = state;
  const job = glimpse.jobs.find((item) => item.id === jobId)!;
  for (let i = 0; i < tapsNeeded(job, glimpse); i += 1) next = tapAt(next, glimpse, jobId, t);
  return next;
}

describe('glimpse：这一轮只路过一件机会', () => {
  it('三件机会轮着放出来：羊 → 柴 → 水囊 → 又回到羊', () => {
    expect(currentJob(glimpse, 0)?.id).toBe('sheep');
    expect(currentJob(glimpse, 2999)?.id).toBe('sheep');
    expect(currentJob(glimpse, 3000)?.id).toBe('sheep');
    expect(currentJob(glimpse, 5599)?.id).toBe('sheep');
    expect(currentJob(glimpse, 5600)?.id).toBe('wood');
    expect(currentJob(glimpse, 11200)?.id).toBe('skin');
    expect(currentJob(glimpse, 16800)?.id).toBe('sheep');
  });

  it('fire 没有"只有这一件"的语义 —— 活儿都在那儿等着', () => {
    expect(currentJob(level, 4300)).toBeUndefined();
    expect(travelLeftMs(level, 4300)).toBe(0);
    expect(isTravelOver(level, 999999)).toBe(false);
  });

  it('calm 期点无效 —— 机会还没路过（征兆期也还没开门）', () => {
    const state = windowStart();
    expect(tapAt(state, glimpse, 'sheep', 1000)).toBe(state);
    expect(tapAt(state, glimpse, 'sheep', 2500)).toBe(state);
    expect(jobWork(tapAt(state, glimpse, 'sheep', 1000), glimpse, 'sheep')).toBe(0);
  });

  it('窗口期只能点当前这一轮那件：点下一轮的机会什么也不发生', () => {
    const state = windowStart();
    // 第一轮窗口里路过的是羊；柴要等到第二轮
    expect(currentJob(glimpse, 3200)?.id).toBe('sheep');
    expect(tapAt(state, glimpse, 'wood', 3200)).toBe(state);
    expect(jobWork(tapAt(state, glimpse, 'wood', 3200), glimpse, 'wood')).toBe(0);
    expect(jobWork(tapAt(state, glimpse, 'sheep', 3200), glimpse, 'sheep')).toBe(340);

    // 到了第二轮，柴才是能抓的那件；回头点羊已经无效
    const next = windowStart();
    expect(currentJob(glimpse, 8900)?.id).toBe('wood');
    expect(tapAt(next, glimpse, 'sheep', 8900)).toBe(next);
    expect(jobWork(tapAt(next, glimpse, 'wood', 8900), glimpse, 'wood')).toBe(340);
  });

  it('点到的位置上确实有件机会，但这一轮不该是它 —— 一样不算（零惩罚）', () => {
    // 羊站在路口（画面上的那个点），可第二轮路过的已经是柴了
    expect(jobAt(105, 960, glimpse)?.id).toBe('sheep');
    const state = windowStart();
    expect(tapAt(state, glimpse, 'sheep', 8900)).toBe(state);
    expect(doneCount(state)).toBe(0);
  });

  it('窗口里连点，一件机会抓得住；抓到了再点也不会变', () => {
    const state = grab('sheep', 4300);
    expect(doneCount(state)).toBe(1);
    expect(jobWork(state, glimpse, 'sheep')).toBe(1500);
    expect(tapAt(state, glimpse, 'sheep', 4300)).toBe(state);
  });

  it('一趟走完：还剩多久、是不是走完了', () => {
    expect(travelLeftMs(glimpse, 0)).toBe(45000);
    expect(travelLeftMs(glimpse, 12500)).toBe(32500);
    expect(isTravelOver(glimpse, 44999)).toBe(false);
    expect(travelLeftMs(glimpse, 44999)).toBe(1);
    expect(isTravelOver(glimpse, 45000)).toBe(true);
    expect(travelLeftMs(glimpse, 45000)).toBe(0);
  });

  it('一趟走完还没抓够：判重来，抓到的留着（零惩罚）', () => {
    let state = grab('sheep', 4300);
    for (let i = 0; i < 3; i += 1) state = tapAt(state, glimpse, 'wood', 8900);
    expect(jobWork(state, glimpse, 'wood')).toBe(1020);

    const again = restartTravel(state, glimpse);
    expect(again.done).toEqual(['sheep']); // 顺手牵到的羊不会跑掉
    expect(jobWork(again, glimpse, 'wood')).toBe(0); // 没干完的清零
    expect(again.resets).toBe(1); // 只记一笔"白跑一趟"，不扣星、不结束
    expect(isWindowDone(glimpse, again)).toBe(false);
  });

  it('走完的这一刻，连这一轮的机会也点不动了 —— 这一趟已经结束', () => {
    // 第 9 轮的窗口在 47800 开：此刻路过的仍是水囊，但这一趟（45000）已经走完
    expect(phaseAt(glimpse, 47800)).toBe('window');
    expect(currentJob(glimpse, 47800)?.id).toBe('skin');
    expect(isTravelOver(glimpse, 47800)).toBe(true);
    const state = windowStart();
    expect(tapAt(state, glimpse, 'skin', 47800)).toBe(state);
  });

  it('抓够 goal 件就成功（每一件都只在它自己那一轮的窗口里）', () => {
    let state = grab('sheep', 4300);
    expect(isWindowDone(glimpse, state)).toBe(false);
    state = grab('wood', 8900, state);
    expect(isWindowDone(glimpse, state)).toBe(false);
    state = grab('skin', 14500, state);
    expect(doneCount(state)).toBe(3);
    expect(isWindowDone(glimpse, state)).toBe(true);
    expect(state.done).toEqual(['sheep', 'wood', 'skin']);
  });

  it('不该点的那件干到一半，窗口一关照样清零（零惩罚）', () => {
    let state = windowStart();
    for (let i = 0; i < 3; i += 1) state = tapAt(state, glimpse, 'sheep', 4300);
    const closed = closeWindow(state, glimpse);
    expect(jobWork(closed, glimpse, 'sheep')).toBe(0);
    expect(closed.resets).toBe(1);
  });

  it('无头验证：一趟压短，但每件机会都还轮得到一次', () => {
    const fast = effectiveCycle(glimpse, true, 3);
    expect(fast.cycle).toEqual({ calmMs: 1000, windowMs: 867 });
    expect(fast.travelMs).toBe(15000);
    // 至少要走完 jobs.length 个窗口 —— 否则一趟下来一件也抓不到，会一趟一趟地重走
    expect(fast.travelMs!).toBeGreaterThanOrEqual((fast.cycle.calmMs + fast.cycle.windowMs) * 3);
    expect(effectiveCycle(glimpse, false, 3)).toBe(glimpse);
  });
});

describe('glimpse 的 schema 与边界', () => {
  it('glimpse 必须给 travelMs —— 不然"一趟"就没有长度', () => {
    expect(() => WindowLevelSchema.parse({ ...glimpse, travelMs: undefined })).toThrow();
  });

  it('fire 不许写 travelMs —— 趁火打劫没有"一趟走完"这回事', () => {
    expect(() => WindowLevelSchema.parse({ ...level, travelMs: 45000 })).toThrow();
  });
});
/* ---------------- stir（混水摸鱼）：窗口是自己搅出来的 ---------------- */

/** 淝水边的那口塘：三条鱼，搅一下浑一会儿（与内容 JSON 里的一模一样） */
const stir = WindowLevelSchema.parse({
  mode: 'stir',
  // stir 里"稳多久、乱多久"的周期不参与判定（窗口是自己搅出来的），
  // 但 schema 要它，画面上也要有个"窗口有多长"的参照 —— 取最长的鱼那么多。
  cycle: { calmMs: 1800, windowMs: 2400 },
  jobs: [
    { id: 'carp', x: 175, y: 880, radius: 92, workMs: 1400 },
    { id: 'crucian', x: 575, y: 800, radius: 92, workMs: 1600 },
    { id: 'grass', x: 375, y: 1140, radius: 92, workMs: 1200 },
  ],
  workTapMs: 320,
  goal: 3,
  stir: { x: 375, y: 560, radius: 96, perTapMs: 900, clearPerSec: 45, muddyAt: 60 },
  hint: '先把水搅浑',
});

/** 在浑水期把一条鱼摸到手里：水清了就先搅一下，再接着摸（与场景同一条路） */
function land(fishId: string, t: number, state = stirStart(stir)) {
  let next = state;
  for (let i = 0; i < 12 && !isJobDone(next, fishId); i += 1) {
    next = isMuddy(stir, next, t) ? tapAt(next, stir, fishId, t) : stirAt(stir, next, t);
  }
  return next;
}

describe('stir：水是清的，窗口要自己搅出来', () => {
  it('开局水是清的：不浑、抓不动、浑水钟只剩 0', () => {
    const state = stirStart(stir);
    expect(murkAt(state, 0)).toBe(0);
    expect(isMuddy(stir, state, 0)).toBe(false);
    expect(muddyLeftMs(stir, state, 0)).toBe(0);
    expect(state.stir?.stirs).toBe(0);
    expect(state.done).toEqual([]);
  });

  it('搅一下就浑：一下加 90（perTapMs 按满浑折算），已经够到 muddyAt 以上', () => {
    const state = stirAt(stir, stirStart(stir), 1000);
    expect(murkAt(state, 1000)).toBe(90);
    expect(isMuddy(stir, state, 1000)).toBe(true);
    expect(state.stir?.stirs).toBe(1);
    // (90 − 60) / 45 秒 ≈ 0.67 秒 —— 浑水只够抓几下的，抓不完就再搅
    expect(muddyLeftMs(stir, state, 1000)).toBeCloseTo(((90 - 60) / 45) * 1000, 6);
  });

  it('浑水随时间澄清：45/秒，浑到 muddyAt 以下就摸不动了', () => {
    const state = stirAt(stir, stirStart(stir), 1000);
    expect(murkAt(state, 2000)).toBe(45);
    expect(murkAt(state, 3000)).toBe(0); // 再澄清一秒就到底，不会变成负数
    expect(isMuddy(stir, state, 1600)).toBe(true); // 90 − 27 = 63
    expect(isMuddy(stir, state, 1700)).toBe(false); // 90 − 31.5 = 58.5
    expect(muddyLeftMs(stir, state, 1700)).toBe(0);
  });

  it('浑度封顶 100：连着搅也不会超过，搅一次就算一次', () => {
    let state = stirStart(stir);
    for (let i = 0; i < 4; i += 1) state = stirAt(stir, state, 1000 + i * 55);
    expect(murkAt(state, 1165)).toBe(MURK_MAX);
    expect(state.stir?.stirs).toBe(4);
  });

  it('t 比上一次量浑度还早（时钟倒流）也不会把浑度算成负数', () => {
    const state = stirAt(stir, stirStart(stir), 5000);
    expect(murkAt(state, 0)).toBe(90);
  });
});

describe('stir：浑水里才抓得动鱼（零惩罚）', () => {
  it('水清的时候点鱼什么也不发生 —— 那条鱼摆尾滑走', () => {
    const state = stirStart(stir);
    expect(tapAt(state, stir, 'carp', 1200)).toBe(state);
    expect(jobWork(tapAt(state, stir, 'carp', 1200), stir, 'carp')).toBe(0);
    expect(doneCount(state)).toBe(0);
  });

  it('搅浑之后连点，鱼就到手了；到手之后点它也不会变', () => {
    let state = stirAt(stir, stirStart(stir), 1000);
    for (let i = 0; i < 5; i += 1) state = tapAt(state, stir, 'carp', 1200);
    expect(doneCount(state)).toBe(1);
    expect(jobWork(state, stir, 'carp')).toBe(1400);
    expect(tapAt(state, stir, 'carp', 1200)).toBe(state);
  });

  it('水一清，摸了一半的鱼滑走：进度清零，摸到的留着（零惩罚，搅一下再来）', () => {
    let state = stirAt(stir, stirStart(stir), 1000);
    for (let i = 0; i < 3; i += 1) state = tapAt(state, stir, 'carp', 1200);
    expect(jobWork(state, stir, 'carp')).toBe(960);

    const cleared = closeWindow(state, stir);
    expect(jobWork(cleared, stir, 'carp')).toBe(0);
    expect(cleared.resets).toBe(1); // 只记一笔"白跑一趟"，不扣星、不结束
    expect(doneCount(cleared)).toBe(0);

    // 再搅一下就能接着摸：不扣星、不结束，也没有别的代价
    const again = stirAt(stir, cleared, 4000);
    expect(isMuddy(stir, again, 4000)).toBe(true);
    expect(jobWork(tapAt(again, stir, 'carp', 4000), stir, 'carp')).toBe(320);
  });

  it('什么也没摸的时候水清了，不算白跑一趟', () => {
    expect(closeWindow(stirStart(stir), stir).resets).toBe(0);
  });

  it('摸到的鱼不会被水清掉', () => {
    const caught = land('grass', 1200);
    expect(doneCount(caught)).toBe(1);
    const cleared = closeWindow(caught, stir);
    expect(cleared.done).toEqual(['grass']);
    expect(jobWork(cleared, stir, 'grass')).toBe(1200);
  });

  it('三条鱼都摸到才算成（每一条都是"搅一下、抓几下"）', () => {
    let state = stirStart(stir);
    for (const id of ['carp', 'crucian', 'grass']) {
      state = stirAt(stir, state, 6000);
      state = land(id, 6000, state);
      expect(isJobDone(state, id)).toBe(true);
    }
    expect(isWindowDone(stir, state)).toBe(true);
    expect(state.done).toEqual(['carp', 'crucian', 'grass']);
    expect(doneCount(state)).toBe(3);
  });
});

describe('stir 的 schema 与边界', () => {
  it('stir 必须给 stir —— 不然不知道水要怎么搅、多快澄清', () => {
    expect(() => WindowLevelSchema.parse({ ...stir, stir: undefined })).toThrow();
  });

  it('fire / glimpse 不许写 stir —— 没有"自己搅出来的窗口"这回事', () => {
    expect(() => WindowLevelSchema.parse({ ...level, stir: stir.stir })).toThrow();
    expect(() => WindowLevelSchema.parse({ ...glimpse, stir: stir.stir })).toThrow();
  });

  it('老模式一个字没改：fire 里 isMuddy 恒为 false，tapAt 照样按窗口判定', () => {
    const state = windowStart();
    expect(isMuddy(level, state, 4300)).toBe(false);
    expect(muddyLeftMs(level, state, 4300)).toBe(0);
    expect(murkAt(state, 4300)).toBe(0);
    // 搅水对 fire 无效：原样返回，连 stirs 都不记
    expect(stirAt(level, state, 4300)).toBe(state);
    // 窗口里点得动、稳的时候点不动 —— 与扩展之前完全一样
    expect(tapJob(state, level, 'boat').work['boat']).toBe(340);
    expect(tapAt(state, level, 'boat', 1000)).toBe(state);
    expect(tapAt(state, level, 'boat', 4300)).not.toBe(state);
  });
});
