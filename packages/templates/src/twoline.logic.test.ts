import { describe, expect, it } from 'vitest';
import { TwolineLevelSchema } from './schemas';
import type { TwolineLevel } from './schemas';
import {
  TWOLINE_TIMING, decoyNow, decoyRatio, hitDecoy, hitReal, isExposed, isTwolineDone,
  needsTopUp, nextLineToTap, realRatio, safeMsLeft, settleDecoy, tapDecoy, tapReal, tapsLeft,
  twolineStart,
} from './twoline.logic';

/** 与第 8 计内容 JSON 里的关卡一模一样：明线栈道 (240,980)，暗线小路 (560,940) */
const level: TwolineLevel = TwolineLevelSchema.parse({
  mode: 'stack',
  decoy: { x: 240, y: 980, radius: 110, max: 100, decayPerSec: 12, topUp: 26, minKeep: 20 },
  real: { x: 560, y: 940, radius: 110, step: 4, goal: 100 },
  hint: '明面撑着，暗线点到底',
});

describe('双线 · 明线会回落', () => {
  it('开局明线是满的 —— 这一关要的是维持，不是从零开始修', () => {
    const state = twolineStart(level);
    expect(state.decoy).toBe(level.decoy.max);
    expect(decoyNow(level, state, 0)).toBe(level.decoy.max);
    expect(decoyRatio(level, state, 0)).toBe(1);
    expect(state.exposed).toBe(0);
  });

  it('明线每秒掉 decayPerSec，掉到底就是 0', () => {
    const state = twolineStart(level);
    expect(decoyNow(level, state, 1000)).toBe(88);
    expect(decoyNow(level, state, 5000)).toBe(40);
    expect(decoyNow(level, state, 20_000)).toBe(0);
    expect(decoyRatio(level, state, 5000)).toBeCloseTo(0.4, 9);
  });

  it('明线跌破 minKeep 之前还剩多久，是算得出来的（画面上那个钟）', () => {
    const state = twolineStart(level);
    // (100 − 20) / 12 秒
    expect(safeMsLeft(level, state, 0)).toBeCloseTo(6666.67, 1);
    expect(safeMsLeft(level, state, 6000)).toBeCloseTo(666.67, 1);
    expect(safeMsLeft(level, state, 7000)).toBe(0);
  });

  it('掉到 minKeep 的 1.5 倍以下就该补了 —— 不是等到被看穿才补', () => {
    const state = twolineStart(level);
    expect(needsTopUp(level, state, 5000)).toBe(false); // 40
    expect(needsTopUp(level, state, 6000)).toBe(true); // 28
    expect(level.decoy.minKeep * TWOLINE_TIMING.urgentRatio).toBe(30);
  });

  it('补一笔加上 topUp，封顶在 max', () => {
    let state = twolineStart(level);
    expect(decoyNow(level, state, 5000)).toBe(40);
    state = tapDecoy(level, state, 5000);
    expect(state.decoy).toBe(66);
    expect(state.decoyTaps).toBe(1);
    // 一补再补会加上去，但绝不会超过上限
    state = tapDecoy(level, state, 5000);
    expect(state.decoy).toBe(92);
    state = tapDecoy(level, state, 5000);
    expect(state.decoy).toBe(level.decoy.max);
    state = tapDecoy(level, state, 5000);
    expect(state.decoy).toBe(level.decoy.max);
  });
});

describe('双线 · 被看穿（零惩罚）', () => {
  it('明线跌破 minKeep = 被看穿；正好压在线上不算', () => {
    const state = twolineStart(level);
    expect(isExposed(level, state, 6666)).toBe(false); // 100 − 79.992 = 20.008，还在线上
    expect(isExposed(level, state, 6667)).toBe(true); // 19.996，跌破了
    expect(isExposed(level, state, 6700)).toBe(true); // 19.6
    expect(isExposed(level, state, 20_000)).toBe(true);
    // 正好压在 minKeep 上不算被看穿
    const atMin = { ...twolineStart(level), decoy: level.decoy.minKeep, decoyAtMs: 0 };
    expect(isExposed(level, atMin, 0)).toBe(false);
  });

  it('被看穿只是补回 minKeep、记一次，**不结束**', () => {
    let state = twolineStart(level);
    state = settleDecoy(level, state, 7000);
    expect(state.decoy).toBe(level.decoy.minKeep);
    expect(state.decoyAtMs).toBe(7000);
    expect(state.exposed).toBe(1);
    expect(isExposed(level, state, 7000)).toBe(false); // 补回之后立刻不算了
    expect(isTwolineDone(level, state)).toBe(false); // 不结束
  });

  it('被看穿一次只记一次账：连着几帧都停在 minKeep 上，exposed 不会每帧涨', () => {
    let state = twolineStart(level);
    for (const t of [7000, 7100, 7200, 7300]) state = settleDecoy(level, state, t);
    expect(state.exposed).toBe(1);
    expect(state.decoy).toBe(level.decoy.minKeep);
    // 隔开足够久还没补一笔，才会再记一次
    state = settleDecoy(level, state, 7000 + TWOLINE_TIMING.exposeGapMs + 100);
    expect(state.exposed).toBe(2);
    expect(state.lastExposedAtMs).toBe(7000 + TWOLINE_TIMING.exposeGapMs + 100);
  });

  it('被看穿之后补一笔就能接着推（零惩罚的重来）', () => {
    let state = settleDecoy(level, twolineStart(level), 7000);
    expect(state.exposed).toBe(1);

    state = tapDecoy(level, state, 7000);
    expect(state.decoy).toBe(level.decoy.minKeep + level.decoy.topUp);
    expect(state.decoyTaps).toBe(1);

    // 补完的这两秒里抓紧推暗线：明线还在掉，但没有再跌破
    for (let t = 7200; t <= 9000; t += 200) state = tapReal(level, state, t);
    expect(state.exposed).toBe(1);
    expect(state.real).toBe(40); // 10 下 × 4
    expect(isTwolineDone(level, state)).toBe(false);

    // 明线又掉下去了：再补一笔（这一次点心虚，连着被抓也不结束）
    state = tapDecoy(level, state, 10_000);
    expect(state.decoy).toBeGreaterThan(level.decoy.minKeep);
    expect(state.exposed).toBeLessThanOrEqual(2);
  });
});

describe('双线 · 暗线推到 goal', () => {
  it('正常路径：明暗交替，暗线到 goal 就算成，一次也不会被看穿', () => {
    let state = twolineStart(level);
    let atMs = 0;
    for (let t = 0; t <= 60_000 && !isTwolineDone(level, state); t += 250) {
      const line = nextLineToTap(level, state, t);
      state = line === 'decoy' ? tapDecoy(level, state, t) : tapReal(level, state, t);
      atMs = t;
    }
    expect(isTwolineDone(level, state)).toBe(true);
    expect(state.real).toBe(level.real.goal);
    expect(state.exposed).toBe(0);
    expect(tapsLeft(level, state)).toBe(0);
    expect(realRatio(level, state)).toBe(1);
    // 二十五下、六秒出头
    expect(state.taps).toBe(25);
    expect(atMs).toBeGreaterThan(5000);
    expect(atMs).toBeLessThan(10_000);
  });

  it('无头验证的那条交替规则能一局点完：明线紧迫补明线，其余点暗线', () => {
    // 与 twoline.ts 的 runAutoplay 同一条规则；场景每帧先结账，再按 200ms 的节拍点一下
    let state = twolineStart(level);
    let nextTap = 0;
    let doneAt = -1;
    for (let t = 0; t <= 60_000; t += 16) {
      state = settleDecoy(level, state, t);
      if (t >= nextTap) {
        nextTap = t + 200;
        const line = nextLineToTap(level, state, t);
        if (line === 'decoy') state = tapDecoy(level, state, t);
        else if (line === 'real') state = tapReal(level, state, t);
      }
      if (isTwolineDone(level, state)) {
        doneAt = t;
        break;
      }
    }
    expect(doneAt).toBeGreaterThan(0);
    expect(doneAt).toBeLessThan(15_000);
    expect(state.exposed).toBe(0); // 交替着来，一次也不会被看穿
  });

  it('只顾暗线：会被看穿好几次，但照样推得完（零惩罚）', () => {
    let state = twolineStart(level);
    for (let t = 400; t <= 60_000 && !isTwolineDone(level, state); t += 400) {
      state = tapReal(level, state, t);
    }
    expect(isTwolineDone(level, state)).toBe(true);
    // 每 400ms 才推一下，明线早就掉下去了：被抓了不止一次
    expect(state.exposed).toBeGreaterThanOrEqual(2);
    // 但每一次都被补回 minKeep，谁也没有结束这一局
    expect(state.decoy).toBeGreaterThanOrEqual(0);
    expect(state.decoy).toBeLessThanOrEqual(level.decoy.max);
  });

  it('暗线封顶在 goal：点再多也不会冒出去', () => {
    let state = twolineStart(level);
    for (let t = 200; t <= 10_000; t += 200) state = tapDecoy(level, state, t);
    for (let t = 10_200; t <= 20_000; t += 200) state = tapReal(level, state, t);
    expect(state.real).toBe(level.real.goal);
    expect(tapsLeft(level, state)).toBe(0);
    // 暗线推完了，但明线这时候已经掉下去了：该点的还是明线（撑着，不是结束）
    expect(nextLineToTap(level, state, 20_000)).toBe('decoy');
    const fine = tapDecoy(level, { ...state, real: level.real.goal }, 20_000);
    expect(nextLineToTap(level, fine, 20_000)).toBeNull();
  });
});

describe('双线 · 关卡验算与点哪儿', () => {
  it('验算：暗线要点 25 下；明线从满到跌破 minKeep 是 6.7 秒 —— 两条线抢同一根手指', () => {
    const state = twolineStart(level);
    expect(tapsLeft(level, state)).toBe(25);
    expect(level.real.goal / level.real.step).toBe(25);
    expect(safeMsLeft(level, state, 0)).toBeGreaterThan(6000);
    expect(safeMsLeft(level, state, 0)).toBeLessThan(7000);
  });

  it('手指落在哪条线上：明线在左、暗线在右，宽容度让小朋友不用对准', () => {
    const d = level.decoy;
    const r = level.real;
    expect(hitDecoy(level, d.x, d.y)).toBe(true);
    expect(hitReal(level, d.x, d.y)).toBe(false);
    expect(hitReal(level, r.x, r.y)).toBe(true);
    expect(hitDecoy(level, r.x, r.y)).toBe(false);
    const off = { x: d.x, y: d.y + d.radius + 30 };
    expect(hitDecoy(level, off.x, off.y)).toBe(false);
    expect(hitDecoy(level, off.x, off.y, 40)).toBe(true);
  });
});

describe('双线 · 边界', () => {
  it('时间往回走（单测里回看）：明线按"还没掉"算，不会算出更高的数', () => {
    const state = tapDecoy(level, twolineStart(level), 5000);
    expect(decoyNow(level, state, 4000)).toBe(state.decoy);
    expect(decoyNow(level, state, 0)).toBe(state.decoy);
  });

  it('一直不管明线：它就停在 minKeep 上（画面红着），不会变成负数', () => {
    let state = twolineStart(level);
    for (let t = 7000; t <= 60_000; t += 5000) state = settleDecoy(level, state, t);
    expect(state.decoy).toBe(level.decoy.minKeep);
    expect(decoyNow(level, state, 99_999)).toBeLessThanOrEqual(level.decoy.minKeep);
    expect(decoyNow(level, state, 99_999)).toBeGreaterThanOrEqual(0);
  });

  it('点暗线也算结账：明线该掉多少掉多少', () => {
    const state = tapReal(level, twolineStart(level), 5000);
    expect(state.decoy).toBe(40);
    expect(state.decoyAtMs).toBe(5000);
    expect(state.real).toBe(level.real.step);
    expect(state.taps).toBe(1);
  });
});
