import { describe, expect, it } from 'vitest';
import { ChainLevelSchema } from './schemas';
import {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gateById, gatesLeft, hasPass,
  hasReturnedHome, homeHit, isAllGatesTaken, isGateTaken, isNextGate, isPassDone, nextGate,
  returnHome, takeGate, takenCount,
} from './chain.logic';

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
