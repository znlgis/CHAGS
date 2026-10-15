import { describe, expect, it } from 'vitest';
import { ChaseLevelSchema } from './schemas';
import {
  CHASE_MAX_DISTANCE, bandOf, chaseAutoplayLevel, chaseMid, chaseStart, distanceBand, hitHold,
  holdWanted, isChaseDone, lostCount, progressRatio, pushyCount, staminaRatio, tick,
} from './chase.logic';
import type { ChaseState } from './chase.logic';
import type { ChaseLevel } from './schemas';

/** 与方案文档第 16 计的关卡一模一样：距离 70、体力 100、区间 34–70 */
const level = ChaseLevelSchema.parse({
  mode: 'hold',
  start: { distance: 70, stamina: 100 },
  keepMin: 34,
  keepMax: 70,
  closePerSec: 16,
  farPerSec: 12,
  drainPerSec: 7,
  recoverPerSec: 4,
  losePerSec: 5,
  hold: { x: 375, y: 1140, radius: 120 },
  hint: '跟住他，别逼太近',
});

/** 按 50ms 一格往前走：真实场景喂的就是墙钟，这里喂的是数字 */
function run(
  rules: ChaseLevel,
  state: ChaseState,
  ms: number,
  holding: boolean,
  dtMs = 50,
): ChaseState {
  let next = state;
  for (let t = 0; t < ms; t += dtMs) next = tick(rules, next, dtMs, holding);
  return next;
}

/** 无头验证该做的事：每一格先问"该按还是该松"，再往前走一格 */
function runAutopilot(rules: ChaseLevel, state: ChaseState, ms: number, dtMs = 50): ChaseState {
  let next = state;
  for (let t = 0; t < ms; t += dtMs) next = tick(rules, next, dtMs, holdWanted(rules, next));
  return next;
}

describe('欲擒故纵 · 追而不逼', () => {
  it('开局：距离 70、体力 100，落在区间里，一次也没逼太近 / 没跟丢', () => {
    const state = chaseStart(level);
    expect(state.distance).toBe(70);
    expect(state.stamina).toBe(100);
    expect(state.progress).toBe(0);
    expect(state.band).toBe('good');
    expect(distanceBand(level, state)).toBe('good');
    expect(pushyCount(state)).toBe(0);
    expect(lostCount(state)).toBe(0);
    expect(isChaseDone(level, state)).toBe(false);
    expect(chaseMid(level)).toBe(52);
  });

  it('一直按住：越追越近，落进 tooClose，体力回涨（记一次 pushy）', () => {
    const after3s = run(level, chaseStart(level), 3000, true);
    // 70 的位置按住 3 秒：16/s × 3 = 48，缩到 22 —— 已经越过 keepMin 34
    expect(after3s.distance).toBeLessThan(level.keepMin);
    expect(distanceBand(level, after3s)).toBe('tooClose');
    expect(pushyCount(after3s)).toBe(1);
    expect(after3s.stamina).toBeLessThan(100);

    // 再按 3 秒：他回头反抗，力气回来了 —— 而且不会超过开局那份
    const after6s = run(level, after3s, 3000, true);
    expect(after6s.stamina).toBeGreaterThan(after3s.stamina);
    expect(after6s.stamina).toBeLessThanOrEqual(level.start.stamina);
    expect(pushyCount(after6s)).toBe(1); // 一直贴在太近里，只算一次

    // 一直按到底：距离落底封在 0
    const floor = run(level, after6s, 8000, true);
    expect(floor.distance).toBe(0); // 70 − 16 × 11 < 0，所以封在 0
  });

  it('一直松手：越拉越远，落进 tooFar，这段追逐的进度往后退（记一次 lost）', () => {
    // 先在区间里追一段（进度涨起来），再松手
    const following = run(level, chaseStart(level), 1000, true);
    expect(following.progress).toBeGreaterThan(0);

    let state = following;
    let progressWhenLost = -1;
    for (let t = 0; t < 8000 && progressWhenLost < 0; t += 50) {
      state = tick(level, state, 50, false);
      if (distanceBand(level, state) === 'tooFar') progressWhenLost = state.progress;
    }
    expect(distanceBand(level, state)).toBe('tooFar');
    expect(lostCount(state)).toBe(1);
    expect(progressWhenLost).toBeGreaterThan(0);

    // 跟丢之后：白追一段，进度按 losePerSec 退
    const later = run(level, state, 2000, false);
    expect(later.progress).toBeLessThan(state.progress);
    expect(lostCount(later)).toBe(1);
    // 一直松到底：距离封在 100，进度退到落底
    const ceiling = run(level, later, 8000, false);
    expect(ceiling.distance).toBe(CHASE_MAX_DISTANCE);
    expect(ceiling.progress).toBe(0);
    expect(progressRatio(ceiling)).toBe(0);
  });

  it('正确维持区间：体力被耗到 0，成功 —— 全程一次也没逼太近、没跟丢', () => {
    const state = runAutopilot(level, chaseStart(level), 13000);
    expect(distanceBand(level, state)).toBe('good');
    expect(pushyCount(state)).toBe(0);
    expect(lostCount(state)).toBe(0);
    expect(isChaseDone(level, state)).toBe(false); // 7/s 掉 100 点，13 秒还差一点

    let done = state;
    let doneAtMs = 0;
    for (let t = 0; t < 10000; t += 50) {
      done = tick(level, done, 50, holdWanted(level, done));
      if (isChaseDone(level, done)) {
        doneAtMs = 13000 + t + 50;
        break;
      }
    }
    // 100 点体力 ÷ 7 点每秒 ≈ 14.3 秒
    expect(doneAtMs).toBeGreaterThan(13500);
    expect(doneAtMs).toBeLessThan(15500);
    expect(staminaRatio(level, done)).toBe(0);
    expect(progressRatio(done)).toBeGreaterThan(0.99);
    expect(pushyCount(done)).toBe(0);
    expect(lostCount(done)).toBe(0);
  });

  it('零惩罚：先逼太近、再跟丢，回头维持区间照样能成', () => {
    const rough = run(level, chaseStart(level), 4000, true); // 冲得太猛
    const alsoLost = run(level, rough, 7000, false); // 又松得太久：0 → 84，越过 keepMax
    expect(pushyCount(alsoLost)).toBe(1);
    expect(lostCount(alsoLost)).toBe(1);
    expect(isChaseDone(level, alsoLost)).toBe(false); // 没有"失败"这回事

    const recovered = runAutopilot(level, alsoLost, 30000);
    expect(isChaseDone(level, recovered)).toBe(true);
    // 花的时间更多了，但星星一颗没少、也没有任何"结束"
    expect(recovered.pushy).toBe(1);
    expect(recovered.lost).toBe(1);
  });

  it('边界：压在 keepMin / keepMax 上算"正好"，多一丝一毫才算偏', () => {
    const base = chaseStart(level);
    expect(bandOf(level, level.keepMin)).toBe('good');
    expect(bandOf(level, level.keepMin - 0.01)).toBe('tooClose');
    expect(bandOf(level, level.keepMax)).toBe('good');
    expect(bandOf(level, level.keepMax + 0.01)).toBe('tooFar');
    expect(distanceBand(level, { ...base, distance: level.keepMin })).toBe('good');
    expect(distanceBand(level, { ...base, distance: 0 })).toBe('tooClose');
    expect(distanceBand(level, { ...base, distance: CHASE_MAX_DISTANCE })).toBe('tooFar');
  });

  it('距离永远在 0–100 之间：胡乱按也好、一直松也好，都出不了这个量程', () => {
    let state = chaseStart(level);
    for (let t = 0; t < 20000; t += 50) {
      state = tick(level, state, 50, t % 400 < 200); // 一会儿按一会儿松
      expect(state.distance).toBeGreaterThanOrEqual(0);
      expect(state.distance).toBeLessThanOrEqual(CHASE_MAX_DISTANCE);
      expect(state.progress).toBeGreaterThanOrEqual(0);
      expect(state.progress).toBeLessThanOrEqual(CHASE_MAX_DISTANCE);
    }
    expect(run(level, chaseStart(level), 20000, false).distance).toBe(CHASE_MAX_DISTANCE);
    expect(run(level, chaseStart(level), 20000, true).distance).toBe(0);
  });

  it('体力回涨封顶在开局那一份；见底之后这一局就定格了', () => {
    const floor = run(level, chaseStart(level), 12000, true);
    expect(floor.distance).toBe(0);
    const refilled = run(level, floor, 60000, true);
    expect(refilled.stamina).toBe(level.start.stamina);

    const done = runAutopilot(level, chaseStart(level), 20000);
    expect(isChaseDone(level, done)).toBe(true);
    const after = tick(level, done, 1000, true);
    expect(after).toBe(done); // 见底了：再按也不会重新爬起来
    expect(after.stamina).toBe(0);
  });

  it('一格时间的退化输入：0 / 负数原样返回；该按还是该松的分界在中点上', () => {
    const state = chaseStart(level);
    expect(tick(level, state, 0, true)).toBe(state);
    expect(tick(level, state, -16, true)).toBe(state);

    expect(holdWanted(level, { ...state, distance: 20 })).toBe(false); // 太近：松手
    expect(holdWanted(level, { ...state, distance: 90 })).toBe(true); // 太远：按住
    expect(holdWanted(level, { ...state, distance: 60 })).toBe(true); // 区间偏上：再收一点
    expect(holdWanted(level, { ...state, distance: 40 })).toBe(false); // 区间偏下：放一点
  });

  it('命中判定：手指落在按住那颗按钮上（宽容度让小朋友不用对准）', () => {
    expect(hitHold(level, 375, 1140)).toBe(true);
    expect(hitHold(level, 375, 1140 + 120)).toBe(true);
    expect(hitHold(level, 375, 1140 + 120, 40)).toBe(true);
    expect(hitHold(level, 375, 1140 + 260)).toBe(false);
    expect(hitHold(level, 120, 500, 40)).toBe(false);
  });

  it('无头验证：只把体力那三条速率放大，距离的手感一字不改', () => {
    expect(chaseAutoplayLevel(level, false)).toBe(level);
    const fast = chaseAutoplayLevel(level, true, 4);
    expect(fast.drainPerSec).toBe(level.drainPerSec * 4);
    expect(fast.recoverPerSec).toBe(level.recoverPerSec * 4);
    expect(fast.losePerSec).toBe(level.losePerSec * 4);
    expect(fast.closePerSec).toBe(level.closePerSec);
    expect(fast.farPerSec).toBe(level.farPerSec);
    // 压缩之后仍然是"区间里掉得比逼太近回得快"
    expect(fast.recoverPerSec).toBeLessThan(fast.drainPerSec);
    // 压缩之后 100 点体力 4 秒内见底 —— 无头验证跑得完
    let state = chaseStart(fast);
    expect(isChaseDone(fast, state)).toBe(false);
    state = runAutopilot(fast, state, 4000);
    expect(isChaseDone(fast, state)).toBe(true);
  });

  it('内容写错在构建期就报错：区间反了 / 逼太近不痛不痒 / 开局不在区间里', () => {
    const base = {
      mode: 'hold',
      start: { distance: 50, stamina: 100 },
      keepMin: 34,
      keepMax: 70,
      closePerSec: 16,
      farPerSec: 12,
      drainPerSec: 7,
      recoverPerSec: 4,
      losePerSec: 5,
      hold: { x: 375, y: 1140, radius: 120 },
      hint: '跟住他，别逼太近',
    };
    expect(ChaseLevelSchema.safeParse(base).success).toBe(true);
    expect(ChaseLevelSchema.safeParse({ ...base, keepMin: 70 }).success).toBe(false);
    expect(ChaseLevelSchema.safeParse({ ...base, recoverPerSec: 7 }).success).toBe(false);
    expect(ChaseLevelSchema.safeParse({ ...base, start: { distance: 20, stamina: 100 } }).success).toBe(false);
    expect(ChaseLevelSchema.safeParse({ ...base, keepMax: 140 }).success).toBe(false);
  });
});