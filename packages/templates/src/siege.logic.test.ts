import { describe, expect, it } from 'vitest';
import { SiegeCloseSchema, SiegeLevelSchema, SiegeSupportSchema, siegeGain } from './schemas';
import {
  frontGain, frontTap, isRelieved, isSiegeDone, nextVital, relieve, resistanceOf,
  siegeProgress, siegeStart, tapsToFinish, untouchedVitals, vitalAt,
} from './siege.logic';
import {
  baseLog, closeExit, closeProgress, closeSchedule, closeStart, closedCount, closingExit,
  closingRatio, escapeExit, escapeLeftMs, exitAt, fireLevel, hasEscaped, isCloseDone,
  isExitClosed, isPulled, isSupportDone, logAt, nextExitToClose, nextLogToPull, pulledCount,
  pullLog, roundElapsedMs, standingCount, supportProgress, supportStart,
} from './siege.logic';

/** 与方案文档第 2 计的关卡一模一样：正面 (200,980,96)，两处要害，阻力 8，goal 20 */
const level = SiegeLevelSchema.parse({
  mode: 'vital',
  front: { x: 200, y: 980, radius: 96 },
  vital: [
    { id: 'grain', x: 560, y: 420, radius: 88, relief: 4 },
    { id: 'gate', x: 300, y: 330, radius: 88, relief: 4 },
  ],
  resistance: 8,
  goal: 20,
  hint: '正面推不动，去点他要救的地方',
});

function taps(level2: typeof level, state: ReturnType<typeof siegeStart>, times: number) {
  let out = state;
  for (let i = 0; i < times; i += 1) out = frontTap(level2, out);
  return out;
}

describe('围魏救赵 · 打要害', () => {
  it('正面推一下的增量就是 siegeGain(阻力) —— 阻力越大推得越少', () => {
    const start = siegeStart();
    expect(frontGain(level, start)).toBe(siegeGain(8));
    expect(frontGain(level, start)).toBe(0.2);
    const afterOne = relieve(level, start, 'grain');
    expect(resistanceOf(level, afterOne)).toBe(4);
    expect(frontGain(level, afterOne)).toBe(siegeGain(4));
  });

  it('不点要害：要推 100 下才到 goal（推不动）', () => {
    const start = siegeStart();
    expect(tapsToFinish(level, start)).toBe(100);
    const almost = taps(level, start, 99);
    expect(isSiegeDone(level, almost.progress)).toBe(false);
    const done = taps(level, almost, 1);
    expect(isSiegeDone(level, done.progress)).toBe(true);
    expect(done.taps).toBe(100);
  });

  it('点完两处要害：阻力降到 0，只要 20 下', () => {
    let state = siegeStart();
    state = relieve(level, state, 'grain');
    state = relieve(level, state, 'gate');
    expect(resistanceOf(level, state)).toBe(0);
    expect(frontGain(level, state)).toBe(1);
    expect(tapsToFinish(level, state)).toBe(20);
    const almost = taps(level, state, 19);
    expect(isSiegeDone(level, almost.progress)).toBe(false);
    const done = taps(level, almost, 1);
    expect(isSiegeDone(level, done.progress)).toBe(true);
  });

  it('点完要害的 20 下，比不点要害的 100 下省力得多 —— 这就是这一计', () => {
    const straight = tapsToFinish(level, siegeStart());
    let both = siegeStart();
    both = relieve(level, both, 'grain');
    both = relieve(level, both, 'gate');
    expect(straight).toBe(100);
    expect(tapsToFinish(level, both)).toBe(20);
    expect(straight).toBeGreaterThan(tapsToFinish(level, both) * 4);
  });

  it('同一个要害点两次不会重复减阻力（返回的还是原来那份状态）', () => {
    const once = relieve(level, siegeStart(), 'grain');
    const twice = relieve(level, once, 'grain');
    expect(twice).toBe(once);
    expect(resistanceOf(level, twice)).toBe(4);
    expect(twice.relieved).toEqual(['grain']);
    expect(isRelieved(twice, 'grain')).toBe(true);
  });

  it('不认识的 id 点什么也不发生', () => {
    const start = siegeStart();
    expect(relieve(level, start, 'nowhere')).toBe(start);
  });

  it('阻力不会被减成负数：要害的 relief 加起来超过初始阻力也只到 0', () => {
    const soft = SiegeLevelSchema.parse({
      mode: 'vital',
      front: { x: 200, y: 980, radius: 96 },
      vital: [
        { id: 'a', x: 560, y: 420, radius: 88, relief: 4 },
        { id: 'b', x: 300, y: 330, radius: 88, relief: 4 },
      ],
      resistance: 4,
      goal: 20,
      hint: '去点要害',
    });
    let state = siegeStart();
    state = relieve(soft, state, 'a');
    state = relieve(soft, state, 'b');
    expect(resistanceOf(soft, state)).toBe(0);
    expect(frontGain(soft, state)).toBe(1);
  });

  it('进度封顶在 goal，进度条不会超过 1', () => {
    const state = taps(level, siegeStart(), 300);
    expect(state.progress).toBe(level.goal);
    expect(siegeProgress(level, state)).toBe(1);
    expect(tapsToFinish(level, state)).toBe(0);
  });

  it('要害的命中判定与"下一个该点哪里"', () => {
    expect(vitalAt(600, 430, level, 56)?.id).toBe('grain');
    expect(vitalAt(600, 430, level, 0)?.id).toBe('grain');
    expect(vitalAt(375, 700, level, 56)).toBeNull();
    const state = relieve(level, siegeStart(), 'grain');
    expect(untouchedVitals(level, state).map((vital) => vital.id)).toEqual(['gate']);
    expect(nextVital(level, state)?.id).toBe('gate');
    const all = relieve(level, state, 'gate');
    expect(nextVital(level, all)).toBeUndefined();
  });

  it('零惩罚：白推几十下也不亏 —— 点完要害接着推，之前推的还算数', () => {
    // 不点要害先硬推 40 下：一下只有 0.2，四十下才挪了 8
    let state = taps(level, siegeStart(), 40);
    expect(state.taps).toBe(40);
    expect(state.progress).toBeCloseTo(8, 6);
    expect(isSiegeDone(level, state.progress)).toBe(false);

    // 点过再点、两处都点：只是把阻力降下来，白推的那些进度留在原地
    state = relieve(level, state, 'grain');
    state = relieve(level, state, 'grain');
    state = relieve(level, state, 'gate');
    expect(state.progress).toBeCloseTo(8, 6);
    expect(tapsToFinish(level, state)).toBe(12);
    const done = taps(level, state, 12);
    expect(isSiegeDone(level, done.progress)).toBe(true);
    expect(done.taps).toBe(52);
  });
});

/* ---------------- 第 19 计 · 釜底抽薪（support） ---------------- */

/** 与第 19 计的关卡一致：火势 100，五根柴，最后那根是根上的（relief 40） */
const support = SiegeSupportSchema.parse({
  mode: 'support',
  fire: { x: 375, y: 620, level: 100 },
  logs: [
    { id: 'l1', x: 170, y: 545, radius: 64, relief: 12, base: false },
    { id: 'l2', x: 580, y: 545, radius: 64, relief: 14, base: false },
    { id: 'l3', x: 170, y: 800, radius: 64, relief: 16, base: false },
    { id: 'l4', x: 580, y: 800, radius: 64, relief: 18, base: false },
    { id: 'l5', x: 375, y: 950, radius: 64, relief: 40, base: true },
  ],
  hint: '别扑火，把底下的柴抽走',
});

describe('釜底抽薪 · 从底下把柴一根根抽走', () => {
  it('开局火势就是关卡里的 100；抽一根降一截', () => {
    const start = supportStart(support);
    expect(fireLevel(support, start)).toBe(100);
    expect(pulledCount(start)).toBe(0);
    expect(standingCount(support, start)).toBe(5);
    expect(supportProgress(support, start)).toBe(0);
    expect(isSupportDone(support, start)).toBe(false);

    const one = pullLog(support, start, 'l1');
    expect(fireLevel(support, one)).toBe(88);
    expect(pulledCount(one)).toBe(1);
    expect(standingCount(support, one)).toBe(4);
    expect(isPulled(one, 'l1')).toBe(true);
    expect(isPulled(one, 'l2')).toBe(false);
    // 抽过的顺序记下来了（画面按它把柴一根根挪开）
    expect(one.order).toEqual(['l1']);
  });

  it('根上的那根（base）抽掉火势骤降 —— 一下顶别的好几根', () => {
    const start = supportStart(support);
    const base = baseLog(support);
    expect(base?.id).toBe('l5');
    expect(base?.relief).toBe(Math.max(...support.logs.map((log) => log.relief)));

    const afterBase = fireLevel(support, pullLog(support, start, 'l5'));
    expect(afterBase).toBe(60);
    for (const log of support.logs) {
      if (log.base) continue;
      expect(fireLevel(support, pullLog(support, start, log.id))).toBeGreaterThan(afterBase);
    }
  });

  it('每根只能抽一次：重复抽返回的还是原来那份状态', () => {
    const once = pullLog(support, supportStart(support), 'l1');
    const twice = pullLog(support, once, 'l1');
    expect(twice).toBe(once);
    expect(pulledCount(twice)).toBe(1);
    expect(fireLevel(support, twice)).toBe(88);
  });

  it('不认识的柴抽不动（原样返回）', () => {
    const start = supportStart(support);
    expect(pullLog(support, start, 'nowhere')).toBe(start);
    expect(isPulled(start, 'nowhere')).toBe(false);
  });

  it('五根抽光火势正好到 0 —— 抽光了才算成', () => {
    let state = supportStart(support);
    for (const log of support.logs.slice(0, 4)) {
      state = pullLog(support, state, log.id);
      expect(isSupportDone(support, state)).toBe(false);
    }
    expect(fireLevel(support, state)).toBe(40);
    expect(supportProgress(support, state)).toBeCloseTo(0.6, 6);

    state = pullLog(support, state, 'l5');
    expect(fireLevel(support, state)).toBe(0);
    expect(isSupportDone(support, state)).toBe(true);
    expect(supportProgress(support, state)).toBe(1);
    expect(standingCount(support, state)).toBe(0);
  });

  it('零惩罚：重复点同一根、不按顺序抽，火势只降不升', () => {
    let state = supportStart(support);
    state = pullLog(support, state, 'l3');
    const afterFirst = fireLevel(support, state);
    expect(afterFirst).toBe(84);

    // 同一根再点两下：不重复记账，火势也不会旺回去
    state = pullLog(support, state, 'l3');
    state = pullLog(support, state, 'l3');
    expect(fireLevel(support, state)).toBe(afterFirst);
    expect(pulledCount(state)).toBe(1);

    // 换一根（不是脚本里的下一根）照样算数 —— 顺序由孩子自己定
    state = pullLog(support, state, 'l1');
    expect(fireLevel(support, state)).toBe(72);
    expect(state.order).toEqual(['l3', 'l1']);
  });

  it('火势不会被抽成负数：relief 加起来超过开局火势也只到 0', () => {
    const weakFire = SiegeSupportSchema.parse({
      ...support,
      fire: { x: 375, y: 620, level: 30 },
    });
    let state = supportStart(weakFire);
    expect(fireLevel(weakFire, state)).toBe(30);
    state = pullLog(weakFire, state, 'l2');
    expect(fireLevel(weakFire, state)).toBe(16);
    state = pullLog(weakFire, state, 'l1');
    expect(fireLevel(weakFire, state)).toBe(4);
    state = pullLog(weakFire, state, 'l3');
    expect(fireLevel(weakFire, state)).toBe(0);
    expect(supportProgress(weakFire, state)).toBe(1);
  });

  it('手指落在哪根柴上、下一根该抽哪根', () => {
    expect(logAt(support, 170, 560, 56)?.id).toBe('l1');
    expect(logAt(support, 170, 560, 0)?.id).toBe('l1');
    // 火堆正中间没有柴：点那儿什么也不发生（零惩罚）
    expect(logAt(support, 375, 700, 0)).toBeUndefined();
    expect(logAt(support, 690, 1200, 56)).toBeUndefined();

    const state = pullLog(support, supportStart(support), 'l1');
    expect(nextLogToPull(support, state)?.id).toBe('l2');
    let all = state;
    for (const log of support.logs) all = pullLog(support, all, log.id);
    expect(nextLogToPull(support, all)).toBeUndefined();
  });
});

/* ---------------- 第 22 计 · 关门捉贼（close） ---------------- */

/** 与第 22 计的关卡一致：四个出口各 1200 毫秒，贼 9000 毫秒之后跑 */
const close = SiegeCloseSchema.parse({
  mode: 'close',
  exits: [
    { id: 'west', x: 140, y: 620, radius: 84, closeMs: 1200 },
    { id: 'east', x: 610, y: 620, radius: 84, closeMs: 1200 },
    { id: 'north', x: 375, y: 330, radius: 84, closeMs: 1200 },
    { id: 'south', x: 375, y: 1010, radius: 84, closeMs: 1200 },
  ],
  thief: { x: 375, y: 690, radius: 80 },
  escapeAfterMs: 9000,
  hint: '趁贼还没跑，把出口都关上',
});

describe('关门捉贼 · 抢在贼跑掉之前把出口关上', () => {
  it('开局：四扇门都还开着，贼的钟开始走', () => {
    const start = closeStart(close, 0);
    expect(start.queue).toEqual([]);
    expect(start.escapes).toBe(0);
    expect(closedCount(close, start, 0)).toBe(0);
    expect(closeProgress(close, start, 0)).toBe(0);
    expect(hasEscaped(close, start, 0)).toBe(false);
    expect(escapeLeftMs(start, 0)).toBe(9000);
    expect(escapeLeftMs(start, 4000)).toBe(5000);
    expect(escapeLeftMs(start, 20000)).toBe(0);
  });

  it('一扇门要 closeMs 才关严：中间还在转，到点才算关好', () => {
    const state = closeExit(close, closeStart(close, 0), 'west', 0);
    expect(state.queue).toEqual(['west']);
    expect(closingExit(close, state, 0)?.id).toBe('west');
    expect(closingRatio(close, state, 0)).toBe(0);
    expect(closingRatio(close, state, 600)).toBeCloseTo(0.5, 6);

    expect(isExitClosed(close, state, 'west', 1199)).toBe(false);
    expect(closingRatio(close, state, 1199)).toBeCloseTo(1199 / 1200, 6);
    expect(isExitClosed(close, state, 'west', 1200)).toBe(true);
    expect(isExitClosed(close, state, 'west', 5000)).toBe(true);
    expect(closingExit(close, state, 1200)).toBeUndefined();
    expect(closingRatio(close, state, 1200)).toBe(0);
    expect(closedCount(close, state, 1200)).toBe(1);
    expect(closeProgress(close, state, 1200)).toBeCloseTo(0.25, 6);
  });

  it('一扇一扇地关：四扇各 1200，全关完正好 4800（比贼的 9000 早）', () => {
    // 一秒钟里连点四扇也全都算数：每一下都排进队里（孩子点得快不该白点）
    let state = closeStart(close, 0);
    for (const id of ['west', 'east', 'south', 'north']) {
      state = closeExit(close, state, id, 0);
    }
    expect(state.queue).toEqual(['west', 'east', 'south', 'north']);
    expect(closeSchedule(close, state).map((item) => item.doneAtMs)).toEqual([
      1200, 2400, 3600, 4800,
    ]);

    expect(isCloseDone(close, state, 4799)).toBe(false);
    expect(closedCount(close, state, 4799)).toBe(3);
    expect(isCloseDone(close, state, 4800)).toBe(true);
    expect(closedCount(close, state, 4800)).toBe(4);
    expect(closeProgress(close, state, 4800)).toBe(1);

    // 关完了就不算跑 —— 哪怕时钟早就过了那个点
    expect(hasEscaped(close, state, 4800)).toBe(false);
    expect(hasEscaped(close, state, 9000)).toBe(false);
    expect(hasEscaped(close, state, 60000)).toBe(false);
  });

  it('验算：把所有门关一遍要 4800，比贼跑掉的 9000 早 —— 来得及', () => {
    const total = close.exits.reduce((sum, exit) => sum + exit.closeMs, 0);
    expect(close.exits.length).toBe(4);
    expect(close.exits.every((exit) => exit.closeMs === 1200)).toBe(true);
    expect(total).toBe(4800);
    expect(total).toBeLessThan(close.escapeAfterMs);
  });

  it('贼到点还没关完就跑了（零惩罚：重来，账清空、只记一笔）', () => {
    let state = closeStart(close, 0);
    state = closeExit(close, state, 'west', 0);
    state = closeExit(close, state, 'east', 1300);
    expect(closedCount(close, state, 9000)).toBe(2);
    expect(hasEscaped(close, state, 8999)).toBe(false);
    expect(hasEscaped(close, state, 9000)).toBe(true);

    // 重来：门又都开着，贼的钟重新走 —— 不扣星、不结束，只记一笔
    const again = closeStart(close, 9000, state.escapes + 1);
    expect(again.escapes).toBe(1);
    expect(again.queue).toEqual([]);
    expect(closedCount(close, again, 9000)).toBe(0);
    expect(closeProgress(close, again, 9000)).toBe(0);
    expect(hasEscaped(close, again, 9000)).toBe(false);
    expect(hasEscaped(close, again, 17999)).toBe(false);
    expect(escapeLeftMs(again, 9000)).toBe(9000);

    // 重来之后照样关得完：这一局没有"玩坏"这回事
    let retry = again;
    for (const id of ['west', 'east', 'south', 'north']) retry = closeExit(close, retry, id, 9000);
    expect(isCloseDone(close, retry, 9000 + 4800)).toBe(true);
    expect(hasEscaped(close, retry, 9000 + 4800)).toBe(false);
  });

  it('已经关了的、已经排上队的门再点不动；贼跑了之后也点不动（等重来）', () => {
    const one = closeExit(close, closeStart(close, 0), 'west', 0);
    expect(closeExit(close, one, 'west', 0)).toBe(one);
    expect(closeExit(close, one, 'west', 5000)).toBe(one);
    expect(closeExit(close, one, 'nowhere', 0)).toBe(one);

    const escaped = closeStart(close, 0);
    expect(hasEscaped(close, escaped, 9000)).toBe(true);
    expect(closeExit(close, escaped, 'west', 9000)).toBe(escaped);
  });

  it('贼往哪扇门跑：最近的、还没关上的那一扇', () => {
    const start = closeStart(close, 0);
    // 西门与东门离贼一样近（都是 245）—— 并列时取关卡脚本里靠前的
    expect(escapeExit(close, start, 0)?.id).toBe('west');
    expect(nextExitToClose(close, start)?.id).toBe('west');

    const afterWest = closeExit(close, start, 'west', 0);
    expect(nextExitToClose(close, afterWest)?.id).toBe('east');
    // 正在转、还没关严的门仍然算"没关上"：贼照样钻得出去（那扇门也是最近的）
    expect(escapeExit(close, afterWest, 600)?.id).toBe('west');
    // 关严之后它才算关上：这时离贼最近的是东门
    expect(escapeExit(close, afterWest, 1200)?.id).toBe('east');

    let all = closeStart(close, 0);
    for (const id of ['west', 'east', 'south', 'north']) all = closeExit(close, all, id, 0);
    expect(escapeExit(close, all, 4800)).toBeUndefined();
    expect(nextExitToClose(close, all)).toBeUndefined();
  });

  it('手指落在哪扇门上（拿最近的那扇）', () => {
    expect(exitAt(close, 150, 630, 56)?.id).toBe('west');
    expect(exitAt(close, 150, 630, 0)?.id).toBe('west');
    expect(exitAt(close, 375, 400, 56)?.id).toBe('north');
    expect(exitAt(close, 375, 700, 56)).toBeUndefined();
    // 贼站着的地方没有门：点他什么也不发生（零惩罚）
    expect(exitAt(close, 375, 690, 0)).toBeUndefined();
    expect(exitAt(close, 375, 1250, 0)).toBeUndefined();
  });

  it('时钟只往一个方向走：t 比开局还小，不会把门算成关好了', () => {
    const state = closeExit(close, closeStart(close, 5000), 'west', 5000);
    expect(roundElapsedMs(state, 5000)).toBe(0);
    expect(roundElapsedMs(state, 4999)).toBe(0);
    expect(isExitClosed(close, state, 'west', 4999)).toBe(false);
    expect(closedCount(close, state, 0)).toBe(0);
    expect(isExitClosed(close, state, 'west', 6200)).toBe(true);
  });
});
