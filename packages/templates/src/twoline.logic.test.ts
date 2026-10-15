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

/* ---------------- 反间计（twoline.plant）：判定单测 ---------------- */
//
// 老模式（stack）的判定与用例一个字没动：这一段是第六辑新加的模式。
// 新模式的类型与判定另起一段引入，免得碰到上面那些行。

import { TwolinePlantSchema } from './schemas';
import type { TwolinePlantLevel } from './schemas';
import {
  PLANT_TIMING, fitsInLookAway, hitRedirect, hitSpot, isLookingAway, isPlantDone, lookAwayLeftMs,
  plantHold, plantProgress, plantRatio, plantStart, plantStep, redirectLook, visitorAt, visitorWalk,
} from './twoline.logic';

/** 与第 33 计内容 JSON 里的关卡一模一样：案上 (470,566)，帐角的动静 (170,1110) */
const plantLevel: TwolinePlantLevel = TwolinePlantSchema.parse({
  mode: 'plant',
  visitor: { from: { x: 610, y: 950 }, to: { x: 250, y: 950 }, walkMs: 5200, radius: 96 },
  spot: { x: 470, y: 566, radius: 88, plantMs: 1600 },
  redirect: { x: 170, y: 1110, radius: 96, lookAwayMs: 2600 },
  caughtLine: '他回过头，正好看见你的手。',
  plantedLine: '他看见了案上的东西 —— 这一句是他自己说的。',
  hint: '先弄出动静，再按住摆好',
});

/** 一帧多长：与场景里 Phaser 的 delta 同一个数量级 */
const FRAME_MS = 16;

/** 按住摆 oneFrame 帧，返回最后一帧的账 */
function holdFor(
  from: { state: ReturnType<typeof plantStart>; at: number },
  frames: number,
): { state: ReturnType<typeof plantStart>; at: number; results: string[] } {
  let state = from.state;
  let at = from.at;
  const results: string[] = [];
  for (let i = 0; i < frames; i += 1) {
    const tick = plantStep(plantLevel, state, at, FRAME_MS, true);
    state = tick.state;
    results.push(tick.result);
    at += FRAME_MS;
  }
  return { state, at, results };
}

describe('反间计 · 他来回踱步（被模拟的人真的在动）', () => {
  it('一个来回是 walkMs：从 from 走到 to，再走回来', () => {
    const { visitor } = plantLevel;
    expect(visitorWalk(plantLevel, 0)).toBeCloseTo(0, 9);
    expect(visitorAt(plantLevel, 0)).toEqual({ x: visitor.from.x, y: visitor.from.y });
    const half = visitorAt(plantLevel, visitor.walkMs / 2);
    expect(half.x).toBeCloseTo(visitor.to.x, 9);
    expect(half.y).toBeCloseTo(visitor.to.y, 9);
    const full = visitorAt(plantLevel, visitor.walkMs);
    expect(full.x).toBeCloseTo(visitor.from.x, 9);
    // 走到四分之一：人真的在两头之间，不是站着不动
    const quarter = visitorAt(plantLevel, visitor.walkMs / 4);
    expect(quarter.x).toBeGreaterThan(Math.min(visitor.from.x, visitor.to.x));
    expect(quarter.x).toBeLessThan(Math.max(visitor.from.x, visitor.to.x));
    // 永远不会走出这两头之间
    for (let t = 0; t <= visitor.walkMs * 3; t += 130) {
      const at = visitorAt(plantLevel, t);
      expect(at.x).toBeGreaterThanOrEqual(Math.min(visitor.from.x, visitor.to.x));
      expect(at.x).toBeLessThanOrEqual(Math.max(visitor.from.x, visitor.to.x));
      expect(at.y).toBe(visitor.from.y);
    }
  });

  it('开局他正看着路（没有空档）：空档要自己点出来', () => {
    const state = plantStart();
    expect(state.progressMs).toBe(0);
    expect(state.caught).toBe(0);
    expect(state.awayUntilMs).toBe(-1);
    expect(state.redirects).toBe(0);
    expect(isLookingAway(state, 0)).toBe(false);
    expect(lookAwayLeftMs(state, 0)).toBe(0);
    expect(plantProgress(state)).toBe(0);
    expect(plantRatio(plantLevel, state)).toBe(0);
    expect(isPlantDone(plantLevel, state)).toBe(false);
  });

  it('弄出点动静：他转头看别处 lookAwayMs，然后回过头来', () => {
    const away = redirectLook(plantLevel, plantStart(), 1000);
    expect(away.redirects).toBe(1);
    expect(lookAwayLeftMs(away, 1000)).toBe(plantLevel.redirect.lookAwayMs);
    expect(lookAwayLeftMs(away, 2000)).toBe(1600);
    expect(isLookingAway(away, 2000)).toBe(true);
    expect(lookAwayLeftMs(away, 1000 + plantLevel.redirect.lookAwayMs)).toBe(0);
    expect(isLookingAway(away, 1000 + plantLevel.redirect.lookAwayMs)).toBe(false);
  });

  it('空档还开着再点一次：从此刻重新算（从宽，不是惩罚）', () => {
    const once = redirectLook(plantLevel, plantStart(), 0);
    const twice = redirectLook(plantLevel, once, 1200);
    expect(twice.redirects).toBe(2);
    expect(lookAwayLeftMs(twice, 1200)).toBe(plantLevel.redirect.lookAwayMs);
    expect(lookAwayLeftMs(twice, 1200 + plantLevel.redirect.lookAwayMs - 1)).toBe(1);
    // 已经摆好了：谁也不用再转头（原样返回）
    const done = { ...plantStart(), planted: true };
    expect(redirectLook(plantLevel, done, 5000)).toBe(done);
  });
});

describe('反间计 · 趁空档按住才推进（零惩罚）', () => {
  it('他正看着的时候按住：什么都不发生，也不记一笔', () => {
    const state = plantStart();
    const idle = plantStep(plantLevel, state, 0, FRAME_MS, true);
    expect(idle.result).toBe('idle');
    expect(idle.state).toBe(state); // 连状态对象都不换
    expect(plantHold(plantLevel, state, 0, FRAME_MS, true)).toBe('idle');
    expect(plantStep(plantLevel, state, 5000, 1000, true).state.progressMs).toBe(0);
    expect(plantStep(plantLevel, state, 5000, 1000, true).state.caught).toBe(0);
  });

  it('没按住就不往前走（松手只是停下来，进度留着）', () => {
    const away = redirectLook(plantLevel, plantStart(), 0);
    // 空档开着、但没按住：一帧都不涨
    expect(plantStep(plantLevel, away, 0, FRAME_MS, false).state.progressMs).toBe(0);
    const half = holdFor({ state: away, at: 0 }, 50).state; // 50 帧 = 800ms
    expect(half.progressMs).toBe(800);
    // 松手：进度留着（这是"再按住接着摆"的地基）
    expect(plantStep(plantLevel, half, 800, FRAME_MS, false).state.progressMs).toBe(800);
    const rest = holdFor({ state: half, at: 800 }, 50).state;
    expect(rest.progressMs).toBe(1600);
    expect(isPlantDone(plantLevel, rest)).toBe(true);
  });

  it('空档里按住：一帧一帧往前走，进度环按它合拢', () => {
    const away = redirectLook(plantLevel, plantStart(), 0);
    const tick = plantStep(plantLevel, away, 0, FRAME_MS, true);
    expect(tick.result).toBe('planting');
    expect(plantProgress(tick.state)).toBe(FRAME_MS);
    expect(plantRatio(plantLevel, tick.state)).toBeCloseTo(FRAME_MS / 1600, 9);
    const quarter = holdFor({ state: away, at: 0 }, 25).state;
    expect(plantProgress(quarter)).toBe(400);
    expect(plantRatio(plantLevel, quarter)).toBeCloseTo(0.25, 9);
  });

  it('摆满 plantMs 就是摆好了：进度封顶，时刻记下来', () => {
    const away = redirectLook(plantLevel, plantStart(), 0);
    const done = holdFor({ state: away, at: 0 }, 120).state; // 120 帧 = 1920ms > 1600
    expect(isPlantDone(plantLevel, done)).toBe(true);
    expect(done.planted).toBe(true);
    expect(done.progressMs).toBe(plantLevel.spot.plantMs);
    expect(plantRatio(plantLevel, done)).toBe(1);
    expect(done.plantedAtMs).toBeGreaterThan(0);
    expect(done.plantedAtMs).toBeLessThan(plantLevel.redirect.lookAwayMs);
    // 摆好了之后喂什么都不动了
    const after = plantStep(plantLevel, done, 9000, 500, true);
    expect(after.state).toBe(done);
    expect(after.result).toBe('idle');
  });

  it('★ 摆到一半他回过头：进度清零、记一笔 caught，但这一局不结束（零惩罚）', () => {
    // 空档从 0 开到 2600；从 1200 才开始按住 —— 回过头的时刻才摆了 1400 毫秒
    const away = redirectLook(plantLevel, plantStart(), 0);
    const half = holdFor({ state: away, at: 1200 }, 87).state; // 1200..2584
    expect(half.progressMs).toBeGreaterThan(0);
    expect(half.progressMs).toBeLessThan(plantLevel.spot.plantMs);

    // 他回过头的这一帧：露馅
    const caughtTick = plantStep(plantLevel, half, 2600, FRAME_MS, true);
    expect(caughtTick.result).toBe('exposed');
    expect(plantHold(plantLevel, half, 2600, FRAME_MS, true)).toBe('exposed');
    expect(caughtTick.state.progressMs).toBe(0);
    expect(caughtTick.state.caught).toBe(1);
    expect(caughtTick.state.lastCaughtAtMs).toBe(2600);
    // 不结束、不扣星：进度只是从头再来
    expect(isPlantDone(plantLevel, caughtTick.state)).toBe(false);
    expect(caughtTick.state.redirects).toBe(1);
  });

  it('露馅一次只记一笔账：还按着也不每帧记账（零惩罚）', () => {
    let state = holdFor({ state: redirectLook(plantLevel, plantStart(), 0), at: 1200 }, 87).state;
    let at = 2600;
    for (let i = 0; i < 30; i += 1) {
      state = plantStep(plantLevel, state, at, FRAME_MS, true).state;
      at += FRAME_MS;
    }
    expect(state.caught).toBe(1);
    expect(state.progressMs).toBe(0);
  });

  it('露馅之后重新弄出动静、重新按住，照样摆得完（零惩罚的重来）', () => {
    const away = redirectLook(plantLevel, plantStart(), 0);
    const caught = plantStep(plantLevel, holdFor({ state: away, at: 1200 }, 87).state, 2600, FRAME_MS, true);
    expect(caught.state.caught).toBe(1);
    // 抬手、再点一次 redirect（空档从此刻重新开）
    const again = redirectLook(plantLevel, plantStep(plantLevel, caught.state, 2700, FRAME_MS, false).state, 2700);
    expect(again.redirects).toBe(2);
    const done = holdFor({ state: again, at: 2700 }, 110).state;
    expect(isPlantDone(plantLevel, done)).toBe(true);
    expect(done.caught).toBe(1); // 被撞见过一次 —— 但这一局照样走完了
  });

  it('照场景同一条路走完一局：一次也不会被撞见', () => {
    // 场景的节奏：每 autoplayStepMs 看一次"该弄动静还是该按住"，每一帧把墙钟喂给 plantStep
    let state = plantStart();
    let holding = false;
    let nextStepAt = 0;
    let at = 0;
    let exposedFrames = 0;
    for (; at <= 30_000 && !isPlantDone(plantLevel, state); at += FRAME_MS) {
      if (at >= nextStepAt) {
        nextStepAt = at + PLANT_TIMING.autoplayStepMs;
        if (isLookingAway(state, at)) {
          holding = true; // 空档开着：按到案上不放
        } else {
          holding = false; // 抬手
          state = redirectLook(plantLevel, state, at); // 弄出点动静
        }
      }
      const tick = plantStep(plantLevel, state, at, FRAME_MS, holding);
      state = tick.state;
      if (tick.result === 'exposed') exposedFrames += 1;
    }
    expect(isPlantDone(plantLevel, state)).toBe(true);
    expect(exposedFrames).toBe(0);
    expect(state.caught).toBe(0);
    // 一个空档（2600ms）就够摆完 1600ms —— 快，但不是比手速
    expect(at).toBeLessThan(10_000);
    expect(state.redirects).toBeGreaterThanOrEqual(1);
    expect(PLANT_TIMING.autoplayStepMs).toBeLessThan(plantLevel.spot.plantMs);
  });

  it('边界：回看不会把空档算成负数，走远了也只是 0', () => {
    const away = redirectLook(plantLevel, plantStart(), 5000);
    // 回看（t 早于点动静的那一刻）：按"空档还没结束"算 —— 绝不会变成负数
    expect(lookAwayLeftMs(away, 4000)).toBe(3600);
    expect(lookAwayLeftMs(away, 4000)).toBeGreaterThan(0);
    expect(isLookingAway(away, 4000)).toBe(true);
    // 走远了：0（他早就回过头了）
    expect(lookAwayLeftMs(away, 99_999)).toBe(0);
    expect(isLookingAway(away, 99_999)).toBe(false);
  });
});

describe('反间计 · 关卡验算与点哪儿', () => {
  it('plantMs 1600 ≤ lookAwayMs 2600：一个空档一定摆得完', () => {
    expect(plantLevel.spot.plantMs).toBe(1600);
    expect(plantLevel.redirect.lookAwayMs).toBe(2600);
    expect(plantLevel.visitor.walkMs).toBe(5200);
    expect(fitsInLookAway(plantLevel)).toBe(true);
    expect(plantLevel.spot.plantMs).toBeLessThan(plantLevel.redirect.lookAwayMs);
  });

  it('一个空档摆不完的数据，schema 当场拒掉（这一关不可能过）', () => {
    const slow = { ...plantLevel, spot: { ...plantLevel.spot, plantMs: 3000 } };
    expect(TwolinePlantSchema.safeParse(slow).success).toBe(false);
    const blink = { ...plantLevel, redirect: { ...plantLevel.redirect, lookAwayMs: 800 } };
    expect(TwolinePlantSchema.safeParse(blink).success).toBe(false);
  });

  it('手指点哪儿：案上要按住、帐角弄动静，两个地方隔着老远不会串', () => {
    const { spot, redirect } = plantLevel;
    expect(hitSpot(plantLevel, spot.x, spot.y)).toBe(true);
    expect(hitRedirect(plantLevel, spot.x, spot.y)).toBe(false);
    expect(hitRedirect(plantLevel, redirect.x, redirect.y)).toBe(true);
    expect(hitSpot(plantLevel, redirect.x, redirect.y)).toBe(false);
    const off = { x: spot.x, y: spot.y + spot.radius + 40 };
    expect(hitSpot(plantLevel, off.x, off.y)).toBe(false);
    expect(hitSpot(plantLevel, off.x, off.y, 60)).toBe(true);
    const apart = Math.hypot(spot.x - redirect.x, spot.y - redirect.y);
    expect(apart).toBeGreaterThan(spot.radius + redirect.radius + 120);
  });
});
