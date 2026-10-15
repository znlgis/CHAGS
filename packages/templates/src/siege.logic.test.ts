import { describe, expect, it } from 'vitest';
import { SiegeLevelSchema, siegeGain } from './schemas';
import {
  frontGain, frontTap, isRelieved, isSiegeDone, nextVital, relieve, resistanceOf,
  siegeProgress, siegeStart, tapsToFinish, untouchedVitals, vitalAt,
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
