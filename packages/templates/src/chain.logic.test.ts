import { describe, expect, it } from 'vitest';
import { ChainLevelSchema } from './schemas';
import {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gateById, gatesLeft, hasPass,
  hasReturnedHome, homeHit, isAllGatesTaken, isGateTaken, isNextGate, isPassDone, nextGate,
  returnHome, takeGate, takenCount,
} from './chain.logic';
// ---- 第 30 计反客为主（step）：新模式的判定（老用例与它上面的 import 一行没动） ----
import { ChainStepSchema } from './schemas';
import type { ChainStepLevel } from './schemas';
import {
  CHAIN_STEP_TIMING, askGrant, grantHit, grantLeftMs, hasAsked, isAllPostsTaken, isGranted,
  isNextPost, isPostTaken, isStepDone, nextPost, nextStep, postAt, postById, postsLeft, stepStart,
  takeOver, takenPosts,
} from './chain.logic';
import type { StepState } from './chain.logic';

/** 第 24 计 · 假道伐虢：先跟虞国谈成借路，再沿路取三处关口，最后回师 */
const level = ChainLevelSchema.parse({
  mode: 'pass',
  envoy: { x: 140, y: 1140, radius: 76 },
  gates: [
    { id: 'g1', x: 250, y: 940, radius: 66, label: '关口一' },
    { id: 'g2', x: 420, y: 720, radius: 66, label: '关口二' },
    { id: 'g3', x: 600, y: 500, radius: 66, label: '关口三' },
  ],
  home: { x: 375, y: 1246, radius: 80 },
  hint: '先借路，再过关口',
});

/** 照真实操作走完一局：借路 → 三个关口按顺序 → 回师 */
function runAll(steps: string[]): ReturnType<typeof chainStart> {
  let state = chainStart();
  for (let i = 0; i < 20 && !isPassDone(level, state); i += 1) {
    const step = chainStep(level, state);
    if (step === undefined) break;
    if (step.kind === 'envoy') {
      steps.push('envoy');
      state = askPass(state, i * CHAIN_TIMING.autoplayStepMs);
    } else if (step.kind === 'gate') {
      steps.push(step.gate.id);
      state = takeGate(level, state, step.gate.id);
    } else {
      steps.push('home');
      state = returnHome(level, state, i * CHAIN_TIMING.autoplayStepMs);
    }
  }
  return state;
}

describe('假道伐虢：先谈成借路', () => {
  it('没借到路之前，一个关口也拿不了（原样返回）', () => {
    const state = chainStart();
    expect(hasPass(state)).toBe(false);
    expect(takeGate(level, state, 'g1')).toBe(state);
    expect(takeGate(level, state, 'g2')).toBe(state);
    expect(takenCount(state)).toBe(0);
    // 提示还是指着第一处关口（孩子一谈成就能走）
    expect(nextGate(level, state)?.id).toBe('g1');
    expect(isPassDone(level, state)).toBe(false);
  });

  it('谈成借路：记下谈成的时刻；再谈一次不重复记账', () => {
    const state = askPass(chainStart(), 1234);
    expect(hasPass(state)).toBe(true);
    expect(state.passAtMs).toBe(1234);
    expect(askPass(state, 9999)).toBe(state);
  });
});

describe('假道伐虢：关口只认"下一个"', () => {
  it('跳着点拿不了：前面的没拿下，后面的动不了', () => {
    const state = askPass(chainStart(), 0);
    expect(takeGate(level, state, 'g3')).toBe(state);
    expect(takeGate(level, state, 'g2')).toBe(state);
    expect(takenCount(state)).toBe(0);
    expect(isNextGate(level, state, 'g1')).toBe(true);
    expect(isNextGate(level, state, 'g2')).toBe(false);
  });

  it('按顺序一处一处拿得下来', () => {
    let state = askPass(chainStart(), 0);
    state = takeGate(level, state, 'g1');
    expect(isGateTaken(state, 'g1')).toBe(true);
    expect(state.taken).toEqual(['g1']);
    expect(takenCount(state)).toBe(1);
    expect(gatesLeft(level, state)).toBe(2);
    expect(nextGate(level, state)?.id).toBe('g2');
    state = takeGate(level, state, 'g2');
    state = takeGate(level, state, 'g3');
    expect(state.taken).toEqual(['g1', 'g2', 'g3']);
    expect(isAllGatesTaken(level, state)).toBe(true);
    expect(nextGate(level, state)).toBeUndefined();
    expect(gatesLeft(level, state)).toBe(0);
    // 全拿下了也还没成：还没回师
    expect(isPassDone(level, state)).toBe(false);
  });

  it('回头点已经拿下的、点不存在的：都原样返回（零惩罚）', () => {
    let state = askPass(chainStart(), 0);
    state = takeGate(level, state, 'g1');
    expect(takeGate(level, state, 'g1')).toBe(state);
    expect(takeGate(level, state, 'ghost')).toBe(state);
    expect(takenCount(state)).toBe(1);
    expect(gateById(level, 'ghost')).toBeUndefined();
  });
});

describe('假道伐虢：没拿完不能回师', () => {
  it('前面还有关口就点自家营地：原样返回', () => {
    let state = askPass(chainStart(), 0);
    state = takeGate(level, state, 'g1');
    expect(returnHome(level, state, 5000)).toBe(state);
    expect(hasReturnedHome(state)).toBe(false);
    // 连"没借路就回师"也一样：原样返回
    const fresh = chainStart();
    expect(returnHome(level, fresh, 5000)).toBe(fresh);
  });

  it('全部关口拿下之后才回得去；回师之后不能再回一次', () => {
    let state = askPass(chainStart(), 0);
    for (const gate of level.gates) state = takeGate(level, state, gate.id);
    const home = returnHome(level, state, 4321);
    expect(hasReturnedHome(home)).toBe(true);
    expect(home.homeAtMs).toBe(4321);
    expect(isPassDone(level, home)).toBe(true);
    expect(returnHome(level, home, 9999)).toBe(home);
  });

  it('三种东西缺一个都不算成：借路 + 关口全拿下 + 回师', () => {
    // 只有借路
    expect(isPassDone(level, askPass(chainStart(), 0))).toBe(false);
    // 借路 + 两个关口
    let state = askPass(chainStart(), 0);
    state = takeGate(level, state, 'g1');
    state = takeGate(level, state, 'g2');
    expect(isPassDone(level, state)).toBe(false);
    // 借路 + 三个关口（还没回师）
    state = takeGate(level, state, 'g3');
    expect(isAllGatesTaken(level, state)).toBe(true);
    expect(isPassDone(level, state)).toBe(false);
    // 回师 = 成了
    expect(isPassDone(level, returnHome(level, state, 100))).toBe(true);
  });

  it('一路点错也照样走得完：点错只是没进展，不结束、不扣星', () => {
    let state = chainStart();
    for (const wrong of ['g1', 'g2', 'g3', 'g3', 'g2']) state = takeGate(level, state, wrong);
    expect(takenCount(state)).toBe(0);
    expect(returnHome(level, state, 100)).toBe(state);
    // 重新照着该走的顺序来一遍，照样成
    const steps: string[] = [];
    const done = runAll(steps);
    expect(isPassDone(level, done)).toBe(true);
  });
});

describe('无头验证：与真实操作同一条路', () => {
  it('借路 → 三个关口按顺序 → 回师', () => {
    const steps: string[] = [];
    const state = runAll(steps);
    expect(steps).toEqual(['envoy', 'g1', 'g2', 'g3', 'home']);
    expect(isPassDone(level, state)).toBe(true);
    expect(state.taken).toEqual(['g1', 'g2', 'g3']);
    expect(hasPass(state)).toBe(true);
    expect(hasReturnedHome(state)).toBe(true);
  });

  it('下一步该干什么：借路 → 关口 → 回师，成了就没有下一步了', () => {
    let state = chainStart();
    expect(chainStep(level, state)).toEqual({ kind: 'envoy' });
    state = askPass(state, 0);
    expect(chainStep(level, state)).toEqual({ kind: 'gate', gate: level.gates[0] });
    state = takeGate(level, state, 'g1');
    expect(chainStep(level, state)).toEqual({ kind: 'gate', gate: level.gates[1] });
    state = takeGate(level, state, 'g2');
    state = takeGate(level, state, 'g3');
    expect(chainStep(level, state)).toEqual({ kind: 'home' });
    state = returnHome(level, state, 100);
    expect(chainStep(level, state)).toBeUndefined();
  });

  it('时间常量：无头验证的步长够画面把上一步演完', () => {
    expect(CHAIN_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(CHAIN_TIMING.envoyMs);
    expect(CHAIN_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(CHAIN_TIMING.gateMs);
    expect(CHAIN_TIMING.homeMs).toBeGreaterThan(0);
    expect(CHAIN_TIMING.finaleHoldMs).toBeGreaterThan(0);
  });
});

describe('点选与边界', () => {
  it('点关口 / 借路处 / 自家营地：圆心与边缘都算，最近的那个优先', () => {
    expect(gateAt(level, 250, 940, 0)?.id).toBe('g1');
    expect(gateAt(level, 250 + 66, 940, 0)?.id).toBe('g1');
    expect(gateAt(level, 250 + 67, 940, 0)).toBeUndefined();
    expect(gateAt(level, 250, 940 + 100, 44)?.id).toBe('g1'); // 宽容度：手指粗一点也点得到
    expect(gateAt(level, 375, 300, 60)).toBeUndefined();
    expect(envoyHit(level, 140, 1140, 0)).toBe(true);
    expect(envoyHit(level, 140 + 77, 1140, 0)).toBe(false);
    expect(homeHit(level, 375, 1246, 0)).toBe(true);
    expect(homeHit(level, 375 + 81, 1246, 0)).toBe(false);
    expect(homeHit(level, 375 + 100, 1246, 44)).toBe(true);
  });

  it('三到五处关口都合法；两处、六处、重名都不许', () => {
    const gate = (id: string): { id: string; x: number; y: number; radius: number; label: string } =>
      ({ id, x: 100, y: 900, radius: 60, label: '关口' });
    expect(() =>
      ChainLevelSchema.parse({ ...level, gates: [gate('a'), gate('b')] }),
    ).toThrow();
    expect(() =>
      ChainLevelSchema.parse({
        ...level,
        gates: [gate('a'), gate('b'), gate('c'), gate('d'), gate('e'), gate('f')],
      }),
    ).toThrow();
    expect(() =>
      ChainLevelSchema.parse({ ...level, gates: [gate('a'), gate('b'), gate('a')] }),
    ).toThrow();
    // 五处（schema 的上限）也合法
    expect(
      ChainLevelSchema.parse({
        ...level,
        gates: [gate('a'), gate('b'), gate('c'), gate('d'), gate('e')],
      }).gates,
    ).toHaveLength(5);
  });

  it('关口木牌上的标签要短（≤12 字），提示语也要短（≤24 字）', () => {
    expect(() =>
      ChainLevelSchema.parse({
        ...level,
        gates: [{ ...level.gates[0]!, label: '很长的关口名字'.repeat(3) }, ...level.gates.slice(1)],
      }),
    ).toThrow();
    expect(() => ChainLevelSchema.parse({ ...level, hint: '太长的提示语'.repeat(6) })).toThrow();
  });
});
/* ---------------- 第 30 计 · 反客为主（step）：只追加，上面的用例一行没动 ---------------- */

/** 与第 30 计内容 JSON 里的关卡一模一样：四处在路上、求允许的营帐、允许 3200 毫秒 */
const stepLevel: ChainStepLevel = ChainStepSchema.parse({
  mode: 'step',
  posts: [
    { id: 'fu-camp', x: 380, y: 970, radius: 76, label: '涪城营帐' },
    { id: 'jiameng-pass', x: 620, y: 760, radius: 76, label: '葭萌关' },
    { id: 'luo-city', x: 300, y: 545, radius: 76, label: '雒城' },
    { id: 'chengdu', x: 560, y: 335, radius: 76, label: '成都' },
  ],
  grant: { x: 130, y: 1130, radius: 84 },
  grantMs: 3200,
  hint: '先求允许，再接管下一个岗位',
});

/**
 * 照真实操作走完一局：求一次允许 → 在有效期内接管一个 → 再求下一次
 * （与场景的 runAutoplay 走的是同一条路）。
 */
function runStep(
  level: ChainStepLevel,
  from: StepState = stepStart(),
  startAt = 0,
): { state: StepState; at: number; moves: string[] } {
  let state = from;
  let t = startAt;
  const moves: string[] = [];
  for (let guard = 0; guard < 20 && !isStepDone(level, state); guard += 1) {
    const move = nextStep(level, state, t);
    if (move === undefined) break;
    if (move.kind === 'grant') {
      moves.push('grant');
      state = askGrant(state, t);
    } else {
      moves.push(move.post.id);
      state = takeOver(level, state, move.post.id, t);
    }
    t += CHAIN_STEP_TIMING.autoplayStepMs;
  }
  return { state, at: t, moves };
}

describe('反客为主 · 没被允许就接手不了', () => {
  it('还没求允许：点哪个岗位都是原样返回（不是禁止点击，是这一步得先问过）', () => {
    const start = stepStart();
    expect(isGranted(stepLevel, start, 0)).toBe(false);
    expect(grantLeftMs(stepLevel, start, 0)).toBe(0);
    for (const post of stepLevel.posts) expect(takeOver(stepLevel, start, post.id, 0)).toBe(start);
    expect(takenPosts(start)).toBe(0);
    expect(postsLeft(stepLevel, start)).toBe(4);
    // 提示还是指着第一处岗位（孩子一求到允许就能接）
    expect(nextPost(stepLevel, start)?.id).toBe('fu-camp');
    expect(isStepDone(stepLevel, start)).toBe(false);
    expect(hasAsked(start)).toBe(false);
  });

  it('允许过期接管不了：最后 1 毫秒还算数，到点就作废（重新求一次就好）', () => {
    const asked = askGrant(stepStart(), 1000);
    expect(hasAsked(asked)).toBe(true);
    expect(asked.grantAtMs).toBe(1000);
    expect(asked.asks).toBe(1);
    expect(grantLeftMs(stepLevel, asked, 1000)).toBe(stepLevel.grantMs);
    expect(grantLeftMs(stepLevel, asked, 1000 + stepLevel.grantMs - 1)).toBe(1);
    expect(isGranted(stepLevel, asked, 1000 + stepLevel.grantMs - 1)).toBe(true);
    // 最后一毫秒接手：算数
    const inTime = takeOver(stepLevel, asked, 'fu-camp', 1000 + stepLevel.grantMs - 1);
    expect(inTime).not.toBe(asked);
    expect(isPostTaken(inTime, 'fu-camp')).toBe(true);
    // 到点那一刻就作废：原样返回，零惩罚
    expect(grantLeftMs(stepLevel, asked, 1000 + stepLevel.grantMs)).toBe(0);
    expect(isGranted(stepLevel, asked, 1000 + stepLevel.grantMs)).toBe(false);
    expect(takeOver(stepLevel, asked, 'fu-camp', 1000 + stepLevel.grantMs)).toBe(asked);
    expect(takenPosts(asked)).toBe(0);
    // 过期不是惩罚：重新求一次，照样接得下来
    const again = askGrant(asked, 9000);
    expect(again.asks).toBe(2);
    expect(again.grantAtMs).toBe(9000);
    expect(takeOver(stepLevel, again, 'fu-camp', 9000)).not.toBe(again);
  });

  it('允许是一次性的：接手一处岗位就用掉，下一步要重新求', () => {
    const asked = askGrant(stepStart(), 0);
    const first = takeOver(stepLevel, asked, 'fu-camp', 200);
    expect(isPostTaken(first, 'fu-camp')).toBe(true);
    expect(first.grantAtMs).toBe(-1);
    expect(isGranted(stepLevel, first, 300)).toBe(false);
    // 手里没允许了：下一处岗位点不动 —— 得先回去求
    expect(takeOver(stepLevel, first, 'jiameng-pass', 300)).toBe(first);
    const askedAgain = askGrant(first, 400);
    expect(takeOver(stepLevel, askedAgain, 'jiameng-pass', 500)).not.toBe(askedAgain);
  });

  it('只能按顺序接管：跳着点、回头点、点个不存在的，都是原样返回（零惩罚）', () => {
    const state = askGrant(stepStart(), 0);
    expect(isNextPost(stepLevel, state, 'fu-camp')).toBe(true);
    expect(isNextPost(stepLevel, state, 'jiameng-pass')).toBe(false);
    expect(takeOver(stepLevel, state, 'jiameng-pass', 100)).toBe(state);
    expect(takeOver(stepLevel, state, 'chengdu', 100)).toBe(state);
    expect(takeOver(stepLevel, state, 'no-such-post', 100)).toBe(state);
    expect(postById(stepLevel, 'no-such-post')).toBeUndefined();
    expect(takenPosts(state)).toBe(0);

    const first = takeOver(stepLevel, state, 'fu-camp', 100);
    expect(first.taken).toEqual(['fu-camp']);
    expect(postsLeft(stepLevel, first)).toBe(3);
    // 回头点已经接手的：没进展（而且此时允许已经用掉了）
    expect(takeOver(stepLevel, first, 'fu-camp', 200)).toBe(first);
    const askedAgain = askGrant(first, 300);
    // 重新求到允许之后，下一处岗位才接得下来
    expect(takeOver(stepLevel, askedAgain, 'jiameng-pass', 400)).not.toBe(askedAgain);
  });

  it('一路点错也照样走得完：点错只是没进展，不结束、不扣星', () => {
    let state = stepStart();
    for (const wrong of ['chengdu', 'luo-city', 'jiameng-pass', 'fu-camp']) {
      state = takeOver(stepLevel, state, wrong, 0);
    }
    expect(takenPosts(state)).toBe(0); // 一次也没求过允许：全都没接手
    const { state: done } = runStep(stepLevel, state, 1000);
    expect(isStepDone(stepLevel, done)).toBe(true);
    expect(takenPosts(done)).toBe(4);
  });
});

describe('反客为主 · 全部接管 = 成了主导', () => {
  it('四处岗位一处一处接下来：taken 的顺序就是岗位的顺序', () => {
    const { state, moves } = runStep(stepLevel);
    expect(moves).toEqual([
      'grant', 'fu-camp', 'grant', 'jiameng-pass', 'grant', 'luo-city', 'grant', 'chengdu',
    ]);
    expect(state.taken).toEqual(['fu-camp', 'jiameng-pass', 'luo-city', 'chengdu']);
    expect(takenPosts(state)).toBe(4);
    expect(postsLeft(stepLevel, state)).toBe(0);
    expect(isAllPostsTaken(stepLevel, state)).toBe(true);
    expect(isStepDone(stepLevel, state)).toBe(true);
    expect(state.asks).toBe(4);
    expect(nextPost(stepLevel, state)).toBeUndefined();
  });

  it('少一处都不算成：每接一处都还在半路上', () => {
    let state = stepStart();
    let t = 0;
    for (const post of stepLevel.posts) {
      expect(isStepDone(stepLevel, state)).toBe(false);
      state = askGrant(state, t);
      state = takeOver(stepLevel, state, post.id, t + 10);
      t += CHAIN_STEP_TIMING.autoplayStepMs;
    }
    expect(isStepDone(stepLevel, state)).toBe(true);
    // 成了之后没有下一步了
    expect(nextStep(stepLevel, state, t)).toBeUndefined();
  });

  it('autoplay 那条路：一步一问，每一步都远在允许过期之前', () => {
    const { state, at, moves } = runStep(stepLevel);
    expect(isStepDone(stepLevel, state)).toBe(true);
    // 八步走完，每一段都只用一个 autoplayStepMs —— 比 grantMs 短得多
    expect(CHAIN_STEP_TIMING.autoplayStepMs).toBeLessThan(stepLevel.grantMs);
    expect(at + CHAIN_STEP_TIMING.finaleHoldMs).toBeLessThan(30_000);
    expect(moves.filter((move) => move === 'grant')).toHaveLength(stepLevel.posts.length);
  });

  it('下一步该干什么：先求允许，有允许了就接下一个岗位', () => {
    expect(nextStep(stepLevel, stepStart(), 0)).toEqual({ kind: 'grant' });
    const asked = askGrant(stepStart(), 0);
    expect(nextStep(stepLevel, asked, 100)).toEqual({ kind: 'post', post: stepLevel.posts[0] });
    const first = takeOver(stepLevel, asked, 'fu-camp', 200);
    expect(nextStep(stepLevel, first, 300)).toEqual({ kind: 'grant' });
    expect(nextStep(stepLevel, askGrant(first, 400), 500)).toEqual({
      kind: 'post',
      post: stepLevel.posts[1],
    });
  });
});

describe('反客为主 · 点选与边界', () => {
  it('点岗位 / 求允许处：圆心与边缘都算，最近的优先', () => {
    expect(postAt(stepLevel, 380, 970, 0)?.id).toBe('fu-camp');
    expect(postAt(stepLevel, 380 + 76, 970, 0)?.id).toBe('fu-camp');
    expect(postAt(stepLevel, 380 + 77, 970, 0)).toBeUndefined();
    expect(postAt(stepLevel, 620, 760 + 110, 44)?.id).toBe('jiameng-pass');
    expect(postAt(stepLevel, 375, 700, 40)).toBeUndefined();
    expect(grantHit(stepLevel, 130, 1130, 0)).toBe(true);
    expect(grantHit(stepLevel, 130 + 84, 1130, 0)).toBe(true);
    expect(grantHit(stepLevel, 130 + 85, 1130, 0)).toBe(false);
    expect(grantHit(stepLevel, 130 + 120, 1130, 44)).toBe(true);
    // 站在求允许的营帐里，不会顺手点到哪处岗位
    expect(postAt(stepLevel, stepLevel.grant.x, stepLevel.grant.y, 46)).toBeUndefined();
  });

  it('时间往回走（单测里回看）时按"整张允许还完整"算，不会崩', () => {
    const asked = askGrant(stepStart(), 5000);
    expect(grantLeftMs(stepLevel, asked, 0)).toBe(stepLevel.grantMs);
    // 时间往回走时也不会冒出一个比 grantMs 还长的数
    expect(grantLeftMs(stepLevel, asked, 4999)).toBe(stepLevel.grantMs);
    expect(isGranted(stepLevel, asked, 0)).toBe(true);
    expect(takeOver(stepLevel, asked, 'fu-camp', 0)).not.toBe(asked);
  });

  it('关卡数据体检：允许短于 600 毫秒就是"比手速"，岗位也必须是三到五处', () => {
    expect(() => ChainStepSchema.parse({ ...stepLevel, grantMs: 599 })).toThrow();
    const post = (id: string): { id: string; x: number; y: number; radius: number; label: string } =>
      ({ id, x: 200, y: 800, radius: 70, label: '岗位' });
    expect(() => ChainStepSchema.parse({ ...stepLevel, posts: [post('a'), post('b')] })).toThrow();
    expect(() =>
      ChainStepSchema.parse({
        ...stepLevel,
        posts: [post('a'), post('b'), post('c'), post('d'), post('e'), post('f')],
      }),
    ).toThrow();
    expect(() =>
      ChainStepSchema.parse({ ...stepLevel, posts: [post('a'), post('b'), post('a')] }),
    ).toThrow();
    // 木牌上的字要短（≤12 字），提示语也要短（≤24 字）
    expect(() =>
      ChainStepSchema.parse({
        ...stepLevel,
        posts: [{ ...stepLevel.posts[0]!, label: '很长的岗位名字'.repeat(3) }, ...stepLevel.posts.slice(1)],
      }),
    ).toThrow();
    expect(() => ChainStepSchema.parse({ ...stepLevel, hint: '太长的提示语'.repeat(6) })).toThrow();
    expect(stepLevel.hint.length).toBeLessThanOrEqual(24);
    expect(stepLevel.posts.every((item) => item.label.length <= 12)).toBe(true);
  });
});

/* ---------------- 第 35 计 连环计（domino）：新模式的判定 ---------------- */

import { ChainDominoSchema } from './schemas';
import type { ChainDominoLevel } from './schemas';
import {
  DOMINO_TIMING, advanceDomino, applyDomino, dominoPhaseAt, dominoStart, hasIgnited, igniteChain,
  igniteHit, isDominoDone, isLinkLit, isNextLink, linkAt, linkById, linksLeft, litCount,
  nextDominoMove, nextLink, settleDomino,
} from './chain.logic';
import type { DominoState, DominoVerdict } from './chain.logic';

/** 第 35 计 · 连环计：先点岸边的火种起头，再按顺序把四环一环比一环接上 */
const dominoLevel: ChainDominoLevel = ChainDominoSchema.parse({
  mode: 'domino',
  ignite: { x: 130, y: 1130, radius: 84 },
  links: [
    { id: 'l1', x: 380, y: 970, radius: 76 },
    { id: 'l2', x: 620, y: 760, radius: 76 },
    { id: 'l3', x: 300, y: 545, radius: 76 },
    { id: 'l4', x: 560, y: 335, radius: 76 },
  ],
  windowMs: 2200,
  breakLine: '断了一环，回到岸边重新点一次',
  hint: '先点着火种，再一环一环往下接',
});

/** 一局里所有可能的判定结果 —— 用来钉住"点一下只有这四种结果" */
const VERDICTS: DominoVerdict[] = ['ok', 'wrong', 'expired', 'notStarted'];

/**
 * 照真实操作走一局：起头 → 一环一环点亮（与场景的 runAutoplay 走的是同一条路，
 * 连"点在哪一环上"都过一遍命中判定）。
 */
function runDomino(
  level: ChainDominoLevel,
  from: DominoState = dominoStart(),
  startAt = 0,
): { state: DominoState; at: number; moves: string[] } {
  let state = from;
  let t = startAt;
  const moves: string[] = [];
  for (let guard = 0; guard < 20 && !isDominoDone(level, state); guard += 1) {
    const move = nextDominoMove(level, state, t);
    if (move === undefined) break;
    if (move.kind === 'ignite') {
      moves.push('ignite');
      state = igniteChain(level, state, t);
    } else {
      moves.push(move.link.id);
      // 与场景同一条路：从"手指落在哪儿"开始判，而不是直接把 id 递进去
      const hit = linkAt(level, move.link.x, move.link.y);
      state = applyDomino(level, state, hit?.id ?? 'missed', t);
    }
    t += DOMINO_TIMING.autoplayStepMs;
  }
  return { state, at: t, moves };
}

describe('连环计 · 没起头，一环也点不亮', () => {
  it('还没起头：点哪一环都是 notStarted，状态原样返回（零惩罚）', () => {
    const start = dominoStart();
    expect(hasIgnited(start)).toBe(false);
    expect(dominoPhaseAt(dominoLevel, start, 0)).toEqual({
      index: 0,
      remainingMs: 0,
      running: false,
    });
    for (const link of dominoLevel.links) {
      expect(advanceDomino(dominoLevel, start, link.id, 0)).toBe('notStarted');
      expect(applyDomino(dominoLevel, start, link.id, 0)).toBe(start);
    }
    expect(litCount(start)).toBe(0);
    expect(linksLeft(dominoLevel, start)).toBe(4);
    // 提示还是指着第一环（孩子一起头就能接）
    expect(nextLink(dominoLevel, start)?.id).toBe('l1');
    expect(nextDominoMove(dominoLevel, start, 0)).toEqual({ kind: 'ignite' });
    expect(isDominoDone(dominoLevel, start)).toBe(false);
  });

  it('起头：链子从第一环开始走，时限从这一刻起算；再起一次头 = 从头再来', () => {
    const started = igniteChain(dominoLevel, dominoStart(), 1000);
    expect(started.ignited).toBe(true);
    expect(started.ignitedAtMs).toBe(1000);
    expect(started.lastAtMs).toBe(1000);
    expect(started.lit).toEqual([]);
    expect(started.ignites).toBe(1);
    expect(started.breaks).toBe(0);
    expect(hasIgnited(started)).toBe(true);
    expect(dominoPhaseAt(dominoLevel, started, 1000)).toEqual({
      index: 0,
      remainingMs: dominoLevel.windowMs,
      running: true,
    });

    // 走到第三环时再起一次头：已点亮的几环不算了，重新从第一环排队（零惩罚）
    let state = applyDomino(dominoLevel, started, 'l1', 1100);
    state = applyDomino(dominoLevel, state, 'l2', 1200);
    expect(state.lit).toEqual(['l1', 'l2']);
    const again = igniteChain(dominoLevel, state, 1500);
    expect(again.lit).toEqual([]);
    expect(again.ignites).toBe(2);
    expect(again.lastAtMs).toBe(1500);
    // 从头再来不记 break（断的是链子，不是"重新起头"这件事）
    expect(again.breaks).toBe(0);
    expect(isNextLink(dominoLevel, again, 'l1')).toBe(true);
    expect(dominoPhaseAt(dominoLevel, again, 1500).remainingMs).toBe(dominoLevel.windowMs);
  });
});

describe('连环计 · 只认"下一环"：顺序点错和不点一样', () => {
  it('跳着点、回头点、点个不存在的：都是 wrong，而且状态原样返回（不扣星、不结束）', () => {
    const state = applyDomino(dominoLevel, igniteChain(dominoLevel, dominoStart(), 0), 'l1', 100);
    expect(state.lit).toEqual(['l1']);
    expect(isNextLink(dominoLevel, state, 'l2')).toBe(true);
    expect(isNextLink(dominoLevel, state, 'l3')).toBe(false);
    expect(isLinkLit(state, 'l1')).toBe(true);

    // 跳着点 / 回头点 / 点个不存在的：判定是 wrong，落账连对象都不换
    expect(advanceDomino(dominoLevel, state, 'l3', 200)).toBe('wrong');
    expect(advanceDomino(dominoLevel, state, 'l4', 200)).toBe('wrong');
    expect(advanceDomino(dominoLevel, state, 'l1', 200)).toBe('wrong');
    expect(advanceDomino(dominoLevel, state, 'no-such-link', 200)).toBe('wrong');
    for (const wrong of ['l3', 'l4', 'l1', 'no-such-link']) {
      expect(applyDomino(dominoLevel, state, wrong, 200)).toBe(state);
    }
    expect(litCount(state)).toBe(1);
    expect(linksLeft(dominoLevel, state)).toBe(3);
    expect(linkById(dominoLevel, 'no-such-link')).toBeUndefined();
    // 点错不消耗时间：下一环照样接得上
    expect(advanceDomino(dominoLevel, state, 'l2', 300)).toBe('ok');
  });

  it('一路乱点也照样走得完：乱点只是没进展', () => {
    let state = igniteChain(dominoLevel, dominoStart(), 0);
    for (const wrong of ['l4', 'l3', 'l2', 'l1', 'l1']) {
      state = applyDomino(dominoLevel, state, wrong, 300);
    }
    // 乱点里 l1 会接上（它确实是下一环），其余全都没进展
    expect(state.lit).toEqual(['l1']);
    const { state: done } = runDomino(dominoLevel, state, 900);
    expect(isDominoDone(dominoLevel, done)).toBe(true);
    expect(done.lit).toEqual(['l1', 'l2', 'l3', 'l4']);
    expect(done.breaks).toBe(0);
  });
});

describe('连环计 · 超时就从 ignite 重来（零惩罚、记一笔 break）', () => {
  it('正好在 windowMs 那一刻断了：链子回到"还没起头"，记一笔 break，重新起头又能走', () => {
    let state = igniteChain(dominoLevel, dominoStart(), 0);
    state = applyDomino(dominoLevel, state, 'l1', 0);
    // 差一毫秒还在：接得上
    expect(dominoPhaseAt(dominoLevel, state, dominoLevel.windowMs - 1).remainingMs).toBe(1);
    expect(advanceDomino(dominoLevel, state, 'l2', dominoLevel.windowMs - 1)).toBe('ok');
    // 正好到点（或者过了）：断了
    expect(dominoPhaseAt(dominoLevel, state, dominoLevel.windowMs).remainingMs).toBe(0);
    expect(dominoPhaseAt(dominoLevel, state, dominoLevel.windowMs).running).toBe(false);
    expect(advanceDomino(dominoLevel, state, 'l2', dominoLevel.windowMs)).toBe('expired');

    const broken = applyDomino(dominoLevel, state, 'l2', dominoLevel.windowMs);
    expect(broken).not.toBe(state);
    expect(broken.breaks).toBe(1);
    expect(broken.ignited).toBe(false);
    expect(broken.ignitedAtMs).toBe(-1);
    expect(broken.lit).toEqual([]);
    // 断了的这一下：什么也没扣（没有分数、没有结束、没有锁）—— 状态里只有"记下来的事"
    expect(Object.keys(broken).sort()).toEqual([
      'breaks', 'ignited', 'ignitedAtMs', 'ignites', 'lastAtMs', 'lit',
    ]);
    expect(isDominoDone(dominoLevel, broken)).toBe(false);
    expect(hasIgnited(broken)).toBe(true); // 起过头（复盘看的是这个过程）

    // 断了之后点哪一环都点不亮：得先重新起头
    expect(advanceDomino(dominoLevel, broken, 'l1', dominoLevel.windowMs + 100)).toBe('notStarted');
    // 重新起头（零惩罚）：又是第一环，接着走，最后照样能成
    const restarted = igniteChain(dominoLevel, broken, dominoLevel.windowMs + 200);
    expect(restarted.lit).toEqual([]);
    expect(restarted.ignites).toBe(2);
    expect(restarted.breaks).toBe(1);
    const { state: done } = runDomino(dominoLevel, restarted, dominoLevel.windowMs + 200);
    expect(isDominoDone(dominoLevel, done)).toBe(true);
    expect(done.lit).toEqual(['l1', 'l2', 'l3', 'l4']);
    expect(done.breaks).toBe(1);
    expect(done.ignites).toBe(2);
  });

  it('断了两次记两笔 break，从来不结束：断一次重来一次，照样走得完', () => {
    let state = igniteChain(dominoLevel, dominoStart(), 0);
    state = applyDomino(dominoLevel, state, 'l1', 0);
    state = applyDomino(dominoLevel, state, 'l2', dominoLevel.windowMs); // 断一次
    expect(state.breaks).toBe(1);
    expect(state.ignited).toBe(false);
    state = igniteChain(dominoLevel, state, 5000);
    state = applyDomino(dominoLevel, state, 'l1', 5000);
    state = applyDomino(dominoLevel, state, 'l2', 5000 + dominoLevel.windowMs); // 再断一次
    expect(state.breaks).toBe(2);
    expect(state.lit).toEqual([]);
    expect(isDominoDone(dominoLevel, state)).toBe(false);
    const { state: done } = runDomino(dominoLevel, igniteChain(dominoLevel, state, 9000), 9000);
    expect(isDominoDone(dominoLevel, done)).toBe(true);
    expect(done.breaks).toBe(2);
    expect(done.ignites).toBe(3);
  });

  it('tick 里每帧调 settleDomino：没断原样返回，断了只记一笔，不会重复记账', () => {
    const running = applyDomino(dominoLevel, igniteChain(dominoLevel, dominoStart(), 0), 'l1', 0);
    // 还在走：原样返回同一个对象（场景据此知道"什么都没发生"）
    expect(settleDomino(dominoLevel, running, 1000)).toBe(running);
    // 到点：断一次
    const broken = settleDomino(dominoLevel, running, dominoLevel.windowMs);
    expect(broken).not.toBe(running);
    expect(broken.breaks).toBe(1);
    // 断了之后再调它（每一帧都调）：原样返回，不会又记一笔
    expect(settleDomino(dominoLevel, broken, dominoLevel.windowMs + 16)).toBe(broken);
    expect(settleDomino(dominoLevel, broken, 99_999).breaks).toBe(1);
    // 一局都没起头的空状态：也不会被"断"
    const start = dominoStart();
    expect(settleDomino(dominoLevel, start, 5000)).toBe(start);
  });

  it('时间往回走（单测里回看）时按"整段时限还完整"算，不会崩', () => {
    const state = igniteChain(dominoLevel, dominoStart(), 5000);
    expect(dominoPhaseAt(dominoLevel, state, 0).remainingMs).toBe(dominoLevel.windowMs);
    expect(dominoPhaseAt(dominoLevel, state, 4999).remainingMs).toBe(dominoLevel.windowMs);
    expect(settleDomino(dominoLevel, state, 0)).toBe(state);
    expect(applyDomino(dominoLevel, state, 'l1', 0)).not.toBe(state);
  });
});

describe('连环计 · 一环一环接完 = 成了', () => {
  it('一局真的走得完：起头 → 四环按顺序 → 成了（与场景同一条路）', () => {
    const { state, moves, at } = runDomino(dominoLevel);
    expect(moves).toEqual(['ignite', 'l1', 'l2', 'l3', 'l4']);
    expect(litCount(state)).toBe(4);
    expect(linksLeft(dominoLevel, state)).toBe(0);
    expect(isDominoDone(dominoLevel, state)).toBe(true);
    expect(state.lit).toEqual(['l1', 'l2', 'l3', 'l4']);
    expect(nextLink(dominoLevel, state)).toBeUndefined();
    expect(nextDominoMove(dominoLevel, state, at)).toBeUndefined();
    expect(dominoPhaseAt(dominoLevel, state, at)).toEqual({
      index: 4,
      remainingMs: 0,
      running: false,
    });
    expect(state.breaks).toBe(0);
    expect(at + DOMINO_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('成了之后再点哪一环都是 wrong：不再重复记账', () => {
    const { state } = runDomino(dominoLevel);
    for (const link of dominoLevel.links) {
      expect(advanceDomino(dominoLevel, state, link.id, 99_999)).toBe('wrong');
      expect(applyDomino(dominoLevel, state, link.id, 99_999)).toBe(state);
    }
    // 成了之后再点火种也不重来（这一局已经完了）
    expect(igniteChain(dominoLevel, state, 99_999)).toBe(state);
    expect(state.lit).toEqual(['l1', 'l2', 'l3', 'l4']);
  });

  it('autoplay 每一步都远在 windowMs 之前 —— 不然无头验证自己就把链子走断了', () => {
    expect(DOMINO_TIMING.autoplayStepMs).toBeLessThan(dominoLevel.windowMs);
    expect(DOMINO_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(
      Math.max(DOMINO_TIMING.igniteMs, DOMINO_TIMING.linkMs),
    );
    const { state, at } = runDomino(dominoLevel);
    expect(state.breaks).toBe(0);
    expect(isDominoDone(dominoLevel, state)).toBe(true);
    expect(at + DOMINO_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('点一下只有这四种结果 —— 判定不会冒出第五种', () => {
    const seen = new Set<DominoVerdict>();
    const fresh = dominoStart();
    const started = igniteChain(dominoLevel, fresh, 0);
    const mid = applyDomino(dominoLevel, started, 'l1', 0);
    const done = runDomino(dominoLevel).state;
    const broken = applyDomino(dominoLevel, mid, 'l2', dominoLevel.windowMs);
    const cases: Array<{ state: DominoState; id: string; t: number }> = [
      { state: fresh, id: 'l1', t: 0 },
      { state: started, id: 'l3', t: 0 },
      { state: started, id: 'l1', t: 0 },
      { state: mid, id: 'l2', t: dominoLevel.windowMs },
      { state: broken, id: 'l1', t: 9999 },
      { state: done, id: 'l4', t: 9999 },
    ];
    for (const item of cases) seen.add(advanceDomino(dominoLevel, item.state, item.id, item.t));
    expect([...seen].sort()).toEqual([...VERDICTS].sort());
  });
});

describe('连环计 · 点选与边界', () => {
  it('点亮哪一环 / 起头处：圆心与边缘都算，最近的优先，手指粗也点得到', () => {
    for (const link of dominoLevel.links) {
      expect(linkAt(dominoLevel, link.x, link.y, 0)?.id).toBe(link.id);
      expect(linkAt(dominoLevel, link.x + link.radius, link.y, 0)?.id).toBe(link.id);
      expect(linkAt(dominoLevel, link.x + link.radius + 1, link.y, 0)).toBeUndefined();
      expect(linkAt(dominoLevel, link.x + link.radius + 30, link.y, 30)?.id).toBe(link.id);
    }
    expect(linkAt(dominoLevel, 375, 700, 0)).toBeUndefined();
    expect(igniteHit(dominoLevel, 130, 1130, 0)).toBe(true);
    expect(igniteHit(dominoLevel, 130 + 84, 1130, 0)).toBe(true);
    expect(igniteHit(dominoLevel, 130 + 85, 1130, 0)).toBe(false);
    expect(igniteHit(dominoLevel, 130 + 120, 1130, 40)).toBe(true);
    // 站在起头的火种上，不会顺手点到哪一环
    expect(linkAt(dominoLevel, dominoLevel.ignite.x, dominoLevel.ignite.y, 46)).toBeUndefined();
  });

  it('关卡数据体检：windowMs 不到 0.9 秒就是"比手速"，环也要三到五个而且 id 不重复', () => {
    expect(() => ChainDominoSchema.parse({ ...dominoLevel, windowMs: 899 })).toThrow();
    expect(() => ChainDominoSchema.parse({ ...dominoLevel, windowMs: 900 })).not.toThrow();
    const link = (id: string) => ({ id, x: 200, y: 800, radius: 70 });
    expect(() => ChainDominoSchema.parse({ ...dominoLevel, links: [link('a'), link('b')] })).toThrow();
    expect(() =>
      ChainDominoSchema.parse({
        ...dominoLevel,
        links: [link('a'), link('b'), link('c'), link('d'), link('e'), link('f')],
      }),
    ).toThrow();
    expect(() =>
      ChainDominoSchema.parse({ ...dominoLevel, links: [link('a'), link('b'), link('a')] }),
    ).toThrow();
    // 断了时那句话与提示语都要短（孩子一眼看得完）
    expect(() => ChainDominoSchema.parse({ ...dominoLevel, hint: '太长的提示语'.repeat(6) })).toThrow();
    expect(() =>
      ChainDominoSchema.parse({ ...dominoLevel, breakLine: '断了一环'.repeat(14) }),
    ).toThrow();
    expect(dominoLevel.hint.length).toBeLessThanOrEqual(24);
    expect(dominoLevel.breakLine.length).toBeLessThanOrEqual(48);
    expect(dominoLevel.links).toHaveLength(4);
    expect(dominoLevel.windowMs).toBe(2200);
  });
});
