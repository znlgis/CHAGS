import { describe, expect, it } from 'vitest';
import { ProbeHintSchema, ProbeKnockSchema, ProbeSpotSchema } from './schemas';
import type { ProbeHintLevel } from './schemas';
import {
  // probe 扩展：hint（指桑骂槐）—— 老模式的那一串一个字没改，只是多了一行
  HINT_TIMING, hintProgress, hintPropAt, hintPropById, hintStart, hintStepsLeft, isHintDone,
  isWantedProp, knockHint, listenerStep, nextHintProp, wantedKind, wrongKnocks,
  PROBE_TIMING, canCross, cross, crossablePatches, figureAt, hasSnake, isFigureTried, isKingFigure,
  isKnockDone, isKnocked, isSpotDone, isSpooked, knock, knockOrder, nextFigureToShoot, nextKnockStep,
  nextPatchToKnock, patchById, probeAt, probeStart, remainingFigures, shoot,
} from './probe.logic';
import type { KnockLevel, ProbeHintState, ProbeState, SpotLevel } from './probe.logic';

/** 第 13 计 · 打草惊蛇：五丛草，两处有蛇，敲到蛇就搅乱它周围一片 */
const knockLevel = ProbeKnockSchema.parse({
  mode: 'knock',
  patches: [
    { id: 'a', x: 120, y: 1080, radius: 60, has: 'snake' },
    { id: 'b', x: 240, y: 1000, radius: 60, has: 'clear' },
    { id: 'c', x: 360, y: 920, radius: 60, has: 'snake' },
    { id: 'd', x: 480, y: 840, radius: 60, has: 'clear' },
    { id: 'e', x: 620, y: 750, radius: 60, has: 'clear' },
  ],
  scareRadius: 150,
  exit: { x: 690, y: 660, radius: 56 },
  hint: '一丛一丛敲，敲到蛇就绕开',
});

/** 第 18 计 · 擒贼擒王：一排五个一模一样的身影，第三个是王 */
const spotLevel = ProbeSpotSchema.parse({
  mode: 'spot',
  figures: [
    { id: 'f1', x: 90, y: 620, radius: 66, isKing: false },
    { id: 'f2', x: 205, y: 620, radius: 66, isKing: false },
    { id: 'f3', x: 320, y: 620, radius: 66, isKing: true },
    { id: 'f4', x: 435, y: 620, radius: 66, isKing: false },
    { id: 'f5', x: 550, y: 620, radius: 66, isKing: false },
  ],
  hint: '用蒿箭一个个试，看谁反应最大',
});

/** 无头验证：照模板 runAutoplay 的同一条路，从最外圈敲到走过去为止 */
function runKnockAutoplay(level: KnockLevel, steps: string[]): ProbeState {
  let state = probeStart();
  for (let i = 0; i < 40 && !isKnockDone(state); i += 1) {
    const step = nextKnockStep(level, state);
    if (step === undefined) break;
    steps.push(step.kind + ':' + step.patch.id);
    state = step.kind === 'cross'
      ? cross(level, state, step.patch.id)
      : knock(level, state, step.patch.id);
  }
  return state;
}

/** 无头验证：按一排里的顺序一个个试到王为止 */
function runSpotAutoplay(level: SpotLevel, steps: string[]): ProbeState {
  let state = probeStart();
  for (let i = 0; i < 40 && !isSpotDone(state); i += 1) {
    const figure = nextFigureToShoot(level, state);
    if (figure === undefined) break;
    steps.push(figure.id);
    state = shoot(level, state, figure.id);
  }
  return state;
}

/** 敲击顺序的全部排列（五丛草 = 120 种）—— "存在解"要在这里面成立才算数 */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

describe('打草惊蛇：敲一处，记一处', () => {
  it('敲过就记下来，还没敲的什么都不算', () => {
    let state = probeStart();
    expect(isKnocked(state, 'b')).toBe(false);
    state = knock(knockLevel, state, 'b');
    expect(isKnocked(state, 'b')).toBe(true);
    expect(state.knocked).toEqual(['b']);
    expect(isSpooked(state, 'b')).toBe(false); // 空草丛敲了也不会惊动谁
    expect(isKnockDone(state)).toBe(false);
  });

  it('同一丛敲第二下不重复记账（原样返回，场景据此跳过重复表演）', () => {
    const once = knock(knockLevel, probeStart(), 'b');
    expect(knock(knockLevel, once, 'b')).toBe(once);
    expect(once.knocked).toEqual(['b']);
  });

  it('脚本里没有这一丛（写错 id）什么也不做，也不抛', () => {
    const state = knock(knockLevel, probeStart(), 'ghost');
    expect(state.knocked).toEqual([]);
    expect(patchById(knockLevel, 'ghost')).toBeUndefined();
  });

  it('敲到蛇：它自己和 scareRadius 内的草丛一起被搅乱，远的那丛不受影响', () => {
    let state = knock(knockLevel, probeStart(), 'b'); // 先敲一丛空的
    state = knock(knockLevel, state, 'a'); // a 里有蛇
    expect(hasSnake(knockLevel, 'a')).toBe(true);
    expect(isSpooked(state, 'a')).toBe(true);
    expect(isSpooked(state, 'b')).toBe(true); // 离 a 144 < 150
    expect(isSpooked(state, 'e')).toBe(false); // 离 a 599 > 150
    expect(state.knocked).toEqual(['b', 'a']);
  });

  it('敲过、确认没有蛇、又没被搅乱，才走得过去', () => {
    let state = knock(knockLevel, probeStart(), 'b');
    expect(canCross(knockLevel, state, 'b')).toBe(true); // 空草丛、还没惊动谁
    state = knock(knockLevel, state, 'a'); // 这一敲把 b 也搅乱了
    expect(isSpooked(state, 'b')).toBe(true);
    expect(canCross(knockLevel, state, 'b')).toBe(false);
    expect(canCross(knockLevel, state, 'a')).toBe(false); // 有蛇的那一丛本来就不能走
    expect(canCross(knockLevel, state, 'ghost')).toBe(false);
    expect(crossablePatches(knockLevel, state)).toEqual([]);
  });

  it('走过去 = 这一关过了；走不过去的地方点了也没事（零惩罚）', () => {
    const state = knock(knockLevel, probeStart(), 'e');
    // 没敲过的地方不能走：原样返回，连状态对象都不换
    expect(cross(knockLevel, state, 'd')).toBe(state);
    expect(isKnockDone(state)).toBe(false);
    const done = cross(knockLevel, state, 'e');
    expect(done.crossed).toBe('e');
    expect(isKnockDone(done)).toBe(true);
  });

  it('惊了蛇也不结束：那一片不能走了，换一处敲就是', () => {
    let state = knock(knockLevel, probeStart(), 'c'); // 中间那丛有蛇
    expect(isSpooked(state, 'b')).toBe(true);
    expect(isSpooked(state, 'd')).toBe(true);
    // 想走被搅乱的那一丛：无事发生
    expect(cross(knockLevel, state, 'd')).toBe(state);
    expect(isKnockDone(state)).toBe(false);
    // 接着敲最外圈那一丛，照样走得掉
    state = knock(knockLevel, state, 'e');
    state = cross(knockLevel, state, 'e');
    expect(isKnockDone(state)).toBe(true);
  });
});

describe('打草惊蛇：该敲哪一丛（从最外圈往里）', () => {
  it('从最外圈往里排：先敲边上，中间的留到最后', () => {
    expect(knockOrder(knockLevel).map((patch) => patch.id)).toEqual(['e', 'a', 'b', 'd', 'c']);
    // 首尾是"边上那两丛"，中间那丛（c）永远最后
    expect(knockOrder(knockLevel)[0]!.id).toBe('e');
    expect(knockOrder(knockLevel)[knockLevel.patches.length - 1]!.id).toBe('c');
  });

  it('跳过已经敲过的，也跳过被搅乱的', () => {
    let state = knock(knockLevel, probeStart(), 'e');
    expect(nextPatchToKnock(knockLevel, state)?.id).toBe('a');
    state = knock(knockLevel, state, 'a'); // a 有蛇，搅乱了 b（和 a 自己）
    expect(nextPatchToKnock(knockLevel, state)?.id).toBe('d'); // b 被搅乱了就跳过它
  });

  it('下一步：能走的先走，走不了就去敲最外圈那一丛', () => {
    const fresh = nextKnockStep(knockLevel, probeStart());
    expect(fresh?.kind).toBe('knock');
    expect(fresh?.patch.id).toBe('e');
    const ready = knock(knockLevel, probeStart(), 'e');
    expect(nextKnockStep(knockLevel, ready)).toEqual({
      kind: 'cross',
      patch: knockLevel.patches.find((patch) => patch.id === 'e'),
    });
    const done = cross(knockLevel, ready, 'e');
    expect(nextKnockStep(knockLevel, done)).toBeUndefined();
  });

  it('敲遍每一丛都不会走到"没得敲"：nextPatchToKnock 一路给得出下一丛', () => {
    let state = probeStart();
    for (let i = 0; i < knockLevel.patches.length; i += 1) {
      const next = nextPatchToKnock(knockLevel, state);
      expect(next).toBeDefined();
      state = knock(knockLevel, state, next!.id);
    }
    expect(nextPatchToKnock(knockLevel, state)).toBeUndefined();
    expect(state.knocked).toHaveLength(knockLevel.patches.length);
  });
});

describe('打草惊蛇：这一关一定有解（schema refine 守的那一条）', () => {
  /** 不在任何蛇的 scareRadius 里的空草丛 —— 它永远搅不乱，这就是"一定有解"的根 */
  function neverSpooked(level: KnockLevel): string[] {
    const snakes = level.patches.filter((patch) => patch.has === 'snake');
    return level.patches
      .filter((patch) => patch.has === 'clear')
      .filter((patch) =>
        snakes.every((snake) => Math.hypot(patch.x - snake.x, patch.y - snake.y) > level.scareRadius),
      )
      .map((patch) => patch.id);
  }

  it('至少有一处空草丛离每条蛇都足够远', () => {
    expect(neverSpooked(knockLevel)).toEqual(['e']);
  });

  it('无论按什么顺序敲（120 种排列），最后都还走得过去', () => {
    const ids = knockLevel.patches.map((patch) => patch.id);
    const orders = permutations(ids);
    expect(orders).toHaveLength(120);
    for (const order of orders) {
      let state = probeStart();
      for (const id of order) state = knock(knockLevel, state, id);
      expect(crossablePatches(knockLevel, state).map((patch) => patch.id)).toEqual(['e']);
      // 而且真的走一步就通了
      expect(isKnockDone(cross(knockLevel, state, 'e'))).toBe(true);
    }
  });

  it('一处这样的草丛都没有的关卡，schema 当场拒掉（不许上路）', () => {
    expect(() =>
      ProbeKnockSchema.parse({
        ...knockLevel,
        // 两处空草丛都贴着某条蛇：一敲就全被搅乱，这一关可能无解
        patches: [
          { id: 'a', x: 120, y: 1080, radius: 60, has: 'snake' },
          { id: 'b', x: 240, y: 1000, radius: 60, has: 'clear' },
          { id: 'c', x: 360, y: 920, radius: 60, has: 'snake' },
          { id: 'd', x: 480, y: 840, radius: 60, has: 'clear' },
        ],
      }),
    ).toThrow();
  });
});

describe('打草惊蛇：点选与边界', () => {
  it('点中圆心与边缘都算；离得远就是点空', () => {
    expect(probeAt(knockLevel, 120, 1080, 0)?.id).toBe('a');
    expect(probeAt(knockLevel, 120 + 60, 1080, 0)?.id).toBe('a');
    expect(probeAt(knockLevel, 120 + 61, 1080, 0)).toBeUndefined();
    expect(probeAt(knockLevel, 120, 1080 + 95, 44)?.id).toBe('a'); // 宽容度：手指粗一点也点得到
    expect(probeAt(knockLevel, 375, 300, 60)).toBeUndefined();
  });

  it('两丛挨着时拿最近的那一丛', () => {
    expect(probeAt(knockLevel, 170, 1045, 40)?.id).toBe('a');
    expect(probeAt(knockLevel, 250, 1010, 40)?.id).toBe('b');
  });

  it('三丛到六丛都合法；两丛、七丛、重名、一处空草都没有 —— 都不许', () => {
    const patch = (id: string): { id: string; x: number; y: number; radius: number; has: 'clear' } => ({
      id, x: 100, y: 900, radius: 40, has: 'clear',
    });
    // 六丛（schema 的上限）也合法：只要留得下一处搅不乱的空草丛
    expect(
      ProbeKnockSchema.parse({
        ...knockLevel,
        patches: [
          { ...patch('a'), has: 'snake' },
          patch('b'),
          patch('c'),
          patch('d'),
          patch('e'),
          { id: 'f', x: 700, y: 900, radius: 40, has: 'clear' },
        ],
      }).patches,
    ).toHaveLength(6);
    expect(() => ProbeKnockSchema.parse({ ...knockLevel, patches: [patch('a'), patch('b')] })).toThrow();
    expect(() =>
      ProbeKnockSchema.parse({
        ...knockLevel,
        patches: [
          { ...patch('a'), has: 'snake' },
          patch('b'), patch('c'), patch('d'), patch('e'), patch('f'), patch('g'),
        ],
      }),
    ).toThrow();
    expect(() =>
      ProbeKnockSchema.parse({
        ...knockLevel,
        patches: [{ ...patch('a'), has: 'snake' }, { ...patch('b'), has: 'snake' }, patch('c')],
      }),
    ).toThrow();
    expect(() =>
      ProbeKnockSchema.parse({ ...knockLevel, patches: [patch('a'), patch('b'), patch('a')] }),
    ).toThrow();
  });

  it('惊动半径必须是正的（0 或负数说明脚本写错了）', () => {
    expect(() => ProbeKnockSchema.parse({ ...knockLevel, scareRadius: 0 })).toThrow();
    expect(() => ProbeKnockSchema.parse({ ...knockLevel, hint: '太长的提示语'.repeat(6) })).toThrow();
  });
});

describe('擒贼擒王：射错只是少一个候选', () => {
  it('射中不是王的：他退到一边，这一关还没成', () => {
    let state = probeStart();
    expect(remainingFigures(spotLevel, state)).toBe(5);
    state = shoot(spotLevel, state, 'f1');
    expect(isFigureTried(state, 'f1')).toBe(true);
    expect(state.tried).toEqual(['f1']);
    expect(isSpotDone(state)).toBe(false);
    expect(remainingFigures(spotLevel, state)).toBe(4);
    expect(nextFigureToShoot(spotLevel, state)?.id).toBe('f2');
  });

  it('同一个身影射两箭不重复计数', () => {
    const once = shoot(spotLevel, probeStart(), 'f1');
    expect(shoot(spotLevel, once, 'f1')).toBe(once);
    expect(once.tried).toEqual(['f1']);
    expect(remainingFigures(spotLevel, once)).toBe(4);
  });

  it('射中王：就是他，这一关成了', () => {
    let state = shoot(spotLevel, probeStart(), 'f1');
    state = shoot(spotLevel, state, 'f3');
    expect(isSpotDone(state)).toBe(true);
    expect(state.king).toBe('f3');
    expect(isKingFigure(spotLevel, 'f3')).toBe(true);
    // 王不是"退到一边的候选"，试过的还是只有 f1
    expect(state.tried).toEqual(['f1']);
    expect(nextFigureToShoot(spotLevel, state)).toBeUndefined();
    expect(nextFigureToShoot(spotLevel, probeStart())?.id).toBe('f1');
  });

  it('射错多少次都还能继续：四个都不是王，最后一个照样射得中', () => {
    let state = probeStart();
    for (const id of ['f1', 'f2', 'f4', 'f5']) state = shoot(spotLevel, state, id);
    expect(isSpotDone(state)).toBe(false);
    expect(state.tried).toEqual(['f1', 'f2', 'f4', 'f5']);
    expect(remainingFigures(spotLevel, state)).toBe(1);
    expect(nextFigureToShoot(spotLevel, state)?.id).toBe('f3');
    state = shoot(spotLevel, state, 'f3');
    expect(isSpotDone(state)).toBe(true);
  });

  it('写错 id、或者已经找到王之后又射 —— 都只是无事发生', () => {
    const fresh = probeStart();
    expect(shoot(spotLevel, fresh, 'ghost')).toBe(fresh);
    const done = shoot(spotLevel, fresh, 'f3');
    expect(shoot(spotLevel, done, 'f1')).toBe(done);
    expect(done.tried).toEqual([]);
  });

  it('点选：点中圆心与边缘都算，两两挨着时拿最近的那个', () => {
    expect(figureAt(spotLevel, 90, 620, 0)?.id).toBe('f1');
    expect(figureAt(spotLevel, 90 - 66, 620, 0)?.id).toBe('f1');
    expect(figureAt(spotLevel, 90 - 67, 620, 0)).toBeUndefined();
    expect(figureAt(spotLevel, 90 - 100, 620, 40)?.id).toBe('f1');
    expect(figureAt(spotLevel, 375, 1100, 60)).toBeUndefined();
    // 两个身影的圆圈叠在一起时，拿最近的（f2 就在那儿）
    expect(figureAt(spotLevel, 160, 620, 0)?.id).toBe('f2');
    expect(figureAt(spotLevel, 147, 620, 0)?.id).toBe('f1');
  });

  it('三到七个身影都合法；王必须恰好一个，重名的也不许', () => {
    const figure = (
      id: string,
      isKing = false,
    ): { id: string; x: number; y: number; radius: number; isKing: boolean } => ({
      id, x: 100, y: 600, radius: 60, isKing,
    });
    expect(() =>
      ProbeSpotSchema.parse({ ...spotLevel, figures: [figure('f1'), figure('f2')] }),
    ).toThrow();
    expect(() =>
      ProbeSpotSchema.parse({
        ...spotLevel,
        figures: [figure('f1', true), figure('f2', true), figure('f3')],
      }),
    ).toThrow();
    expect(() =>
      ProbeSpotSchema.parse({ ...spotLevel, figures: [figure('f1'), figure('f2'), figure('f3')] }),
    ).toThrow();
    expect(() =>
      ProbeSpotSchema.parse({
        ...spotLevel,
        figures: [figure('f1', true), figure('f2'), figure('f1')],
      }),
    ).toThrow();
    expect(
      ProbeSpotSchema.parse({
        ...spotLevel,
        figures: [figure('f1'), figure('f2', true), figure('f3')],
      }).figures.filter((item) => item.isKing),
    ).toHaveLength(1);
  });
});

describe('无头验证：一局真的走得完（照场景 runAutoplay 的同一条路）', () => {
  it('打草惊蛇：从最外圈敲起，敲到安全的那一处就走过去', () => {
    const steps: string[] = [];
    const state = runKnockAutoplay(knockLevel, steps);
    expect(isKnockDone(state)).toBe(true);
    // **从边上敲起**：第一步永远是最外圈那一丛（不是中间那丛）
    expect(steps[0]).toBe('knock:' + knockOrder(knockLevel)[0]!.id);
    expect(steps[0]).toBe('knock:e');
    expect(steps).toEqual(['knock:e', 'cross:e']);
    expect(steps.filter((step) => step.startsWith('cross:'))).toHaveLength(1);
    expect(isSpooked(state, 'e')).toBe(false);
  });

  it('擒贼擒王：按一排里的顺序试到王为止，中间每个只射一箭', () => {
    const steps: string[] = [];
    const state = runSpotAutoplay(spotLevel, steps);
    expect(isSpotDone(state)).toBe(true);
    expect(state.king).toBe('f3');
    expect(state.tried).toEqual(['f1', 'f2']);
    expect(steps).toEqual(['f1', 'f2', 'f3']);
    // 试了两个都不是王，第三箭才射中
    expect(state.tried.length + 1).toBe(3);
  });

  it('时间常量：无头验证的步长够画面把上一步演完', () => {
    expect(PROBE_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(PROBE_TIMING.knockMs);
    expect(PROBE_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(PROBE_TIMING.stepAsideMs);
    // 蛇窜出来那一下（连带着附近的草塌下去）要比普通一敲久一点，看得清
    expect(PROBE_TIMING.scareMs).toBeGreaterThan(PROBE_TIMING.knockMs);
    expect(PROBE_TIMING.finaleHoldMs).toBeGreaterThan(0);
  });

  it('两个模式的状态互不干扰：敲草不会动到射箭的账本', () => {
    const knocked = knock(knockLevel, probeStart(), 'a');
    expect(knocked.tried).toEqual([]);
    expect(knocked.king).toBeNull();
    const shot = shoot(spotLevel, probeStart(), 'f1');
    expect(shot.knocked).toEqual([]);
    expect(shot.crossed).toBeNull();
  });
});

/* ---------------- probe 扩展：hint（第 26 计 · 指桑骂槐） ---------------- */

/**
 * 第 26 计 · 指桑骂槐：桑 / 槐 / 钟 / 鼓 四样东西，二世听得懂的是鼓。
 *
 * 关卡脚本里的 `has` 在这个模式下就是"这样东西的类别"（字段名沿用老模式那个，
 * 它本来就是"这一样是什么"）：`has: 'snake'` 的那一样就是他听得懂的。
 */
const hintLevel = ProbeHintSchema.parse({
  mode: 'hint',
  props: [
    { id: 'mulberry', x: 105, y: 620, radius: 76, has: 'clear' },
    { id: 'ash', x: 285, y: 620, radius: 76, has: 'clear' },
    { id: 'bell', x: 465, y: 620, radius: 76, has: 'clear' },
    { id: 'drum', x: 645, y: 620, radius: 76, has: 'snake' },
  ],
  listener: { x: 375, y: 1010, radius: 80, wants: 'snake' },
  steps: 3,
  hint: '敲对了，他自己往前走',
});

/** 无头验证：照场景 runAutoplay 的同一条路 —— 敲"他听得懂的那一样"，一步接一步 */
function runHintAutoplay(level: ProbeHintLevel, steps: string[]): ProbeHintState {
  let state = hintStart();
  for (let i = 0; i < 20 && !isHintDone(level, state); i += 1) {
    const prop = nextHintProp(level, state);
    if (prop === undefined) break;
    steps.push(prop.id);
    state = knockHint(level, state, prop.id);
  }
  return state;
}

describe('指桑骂槐：敲对了，他自己往前走', () => {
  it('敲到他听得懂的那一样：他往前走一步（进度 +1）', () => {
    const state = hintStart();
    expect(hintProgress(state)).toBe(0);
    expect(isHintDone(hintLevel, state)).toBe(false);
    expect(isWantedProp(hintLevel, 'drum')).toBe(true);
    expect(isWantedProp(hintLevel, 'bell')).toBe(false);
    expect(wantedKind(hintLevel)).toBe('snake');

    const once = knockHint(hintLevel, state, 'drum');
    expect(hintProgress(once)).toBe(1);
    expect(wrongKnocks(once)).toBe(0);
    expect(once.lastKnock).toBe('drum');
    expect(once.lastWasWanted).toBe(true);
    expect(hintStepsLeft(hintLevel, once)).toBe(2);
    expect(listenerStep(hintLevel, once)).toBe(1);
    expect(isHintDone(hintLevel, once)).toBe(false);
  });

  it('走够 steps 步 = 他自己做出了正确的选择（这一关成了）', () => {
    let state = hintStart();
    for (let i = 0; i < hintLevel.steps; i += 1) {
      expect(isHintDone(hintLevel, state)).toBe(false);
      state = knockHint(hintLevel, state, 'drum');
    }
    expect(hintProgress(state)).toBe(hintLevel.steps);
    expect(isHintDone(hintLevel, state)).toBe(true);
    expect(hintStepsLeft(hintLevel, state)).toBe(0);
    expect(listenerStep(hintLevel, state)).toBe(hintLevel.steps);
    expect(nextHintProp(hintLevel, state)).toBeUndefined();
  });

  it('敲错只记一笔：进度不动、不结束、不扣星（零惩罚）', () => {
    let state = hintStart();
    for (const id of ['mulberry', 'ash', 'bell']) {
      state = knockHint(hintLevel, state, id);
    }
    expect(hintProgress(state)).toBe(0);
    expect(wrongKnocks(state)).toBe(3);
    expect(state.lastWasWanted).toBe(false);
    expect(isHintDone(hintLevel, state)).toBe(false);
    // 同一样再敲：账照记，还是零惩罚
    state = knockHint(hintLevel, state, 'bell');
    expect(wrongKnocks(state)).toBe(4);
    expect(hintProgress(state)).toBe(0);
    // 敲错多少下都不影响走不走得完：接着敲对的那一样，照样一步不少
    state = knockHint(hintLevel, state, 'drum');
    state = knockHint(hintLevel, state, 'mulberry'); // 中间再敲错一次也不怕
    state = knockHint(hintLevel, state, 'drum');
    state = knockHint(hintLevel, state, 'drum');
    expect(isHintDone(hintLevel, state)).toBe(true);
    expect(wrongKnocks(state)).toBe(5);
  });

  it('敲过的记下来（重复的不算新的一样），但账目只有"几步 + 敲错几次"', () => {
    let state = hintStart();
    state = knockHint(hintLevel, state, 'ash');
    state = knockHint(hintLevel, state, 'ash');
    state = knockHint(hintLevel, state, 'drum');
    expect(state.knocked).toEqual(['ash', 'drum']);
    expect(hintProgress(state)).toBe(1);
    expect(wrongKnocks(state)).toBe(2);
  });

  it('他已经走够了之后：再敲什么都不会变（原样返回）', () => {
    let done = hintStart();
    for (let i = 0; i < hintLevel.steps; i += 1) done = knockHint(hintLevel, done, 'drum');
    expect(isHintDone(hintLevel, done)).toBe(true);
    expect(knockHint(hintLevel, done, 'drum')).toBe(done);
    expect(knockHint(hintLevel, done, 'mulberry')).toBe(done);
    expect(hintProgress(knockHint(hintLevel, done, 'mulberry'))).toBe(hintLevel.steps);
  });

  it('脚本里没有这一样（写错 id）：什么都没发生，也不抛', () => {
    const state = hintStart();
    expect(knockHint(hintLevel, state, 'ghost')).toBe(state);
    expect(hintPropById(hintLevel, 'ghost')).toBeUndefined();
    expect(hintPropById(hintLevel, 'drum')?.has).toBe('snake');
    expect(state.knocked).toEqual([]);
    expect(wrongKnocks(state)).toBe(0);
  });

  it('点选：圆心与边缘都算，最近的那一样优先', () => {
    expect(hintPropAt(hintLevel, 105, 620, 0)?.id).toBe('mulberry');
    expect(hintPropAt(hintLevel, 105 + 76, 620, 0)?.id).toBe('mulberry');
    expect(hintPropAt(hintLevel, 105 + 77, 620, 0)).toBeUndefined();
    expect(hintPropAt(hintLevel, 105, 620 + 100, 44)?.id).toBe('mulberry'); // 宽容度
    expect(hintPropAt(hintLevel, 375, 240, 60)).toBeUndefined();
    // 两样之间的中间那条线上，拿最近的那一样
    expect(hintPropAt(hintLevel, 196, 620, 44)?.id).toBe('ash');
    expect(hintPropAt(hintLevel, 194, 620, 44)?.id).toBe('mulberry');
  });
});

describe('指桑骂槐：schema 与边界', () => {
  it('至少要有一样是他听得懂的 —— 不然这一关不可能过（schema 当场拒掉）', () => {
    expect(() =>
      ProbeHintSchema.parse({
        ...hintLevel,
        listener: { ...hintLevel.listener, wants: 'ghost' },
      }),
    ).toThrow();
  });

  it('三到五样东西都合法；两样、六样、重名都不许', () => {
    const prop = (id: string): { id: string; x: number; y: number; radius: number; has: 'snake' } =>
      ({ id, x: 100, y: 620, radius: 60, has: 'snake' });
    expect(() =>
      ProbeHintSchema.parse({ ...hintLevel, props: [prop('a'), prop('b')] }),
    ).toThrow();
    expect(() =>
      ProbeHintSchema.parse({ ...hintLevel, props: [prop('a'), prop('b'), prop('c'), prop('d'), prop('e'), prop('f')] }),
    ).toThrow();
    expect(() =>
      ProbeHintSchema.parse({ ...hintLevel, props: [prop('a'), prop('b'), prop('a')] }),
    ).toThrow();
    expect(
      ProbeHintSchema.parse({
        ...hintLevel,
        props: [prop('a'), prop('b'), prop('c'), prop('d'), prop('e')],
      }).props,
    ).toHaveLength(5);
  });

  it('steps 一步到六步都合法，零步与七步不许；提示语不许太长', () => {
    expect(() => ProbeHintSchema.parse({ ...hintLevel, steps: 0 })).toThrow();
    expect(() => ProbeHintSchema.parse({ ...hintLevel, steps: 7 })).toThrow();
    expect(ProbeHintSchema.parse({ ...hintLevel, steps: 1 }).steps).toBe(1);
    expect(ProbeHintSchema.parse({ ...hintLevel, steps: 6 }).steps).toBe(6);
    expect(() => ProbeHintSchema.parse({ ...hintLevel, hint: '太长的提示语'.repeat(6) })).toThrow();
  });

  it('无头验证：一步一步走过去，正好敲 steps 次（与真实操作同一条路）', () => {
    const steps: string[] = [];
    const state = runHintAutoplay(hintLevel, steps);
    expect(steps).toEqual(['drum', 'drum', 'drum']);
    expect(isHintDone(hintLevel, state)).toBe(true);
    expect(hintProgress(state)).toBe(hintLevel.steps);
    // 一次也没敲错：无头验证敲的永远是"他听得懂的那一样"
    expect(wrongKnocks(state)).toBe(0);
    expect(state.knocked).toEqual(['drum']);
  });

  it('时间常量：一次一步看得清，走完一局远在 e2e 的等待之内', () => {
    expect(HINT_TIMING.stepMs).toBeGreaterThanOrEqual(HINT_TIMING.knockMs);
    expect(hintLevel.steps * HINT_TIMING.stepMs + HINT_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('两个账本互不干扰：敲东西不会动到老模式（knock / spot）的账', () => {
    const hint = knockHint(hintLevel, knockHint(hintLevel, hintStart(), 'drum'), 'ash');
    expect(hintProgress(hint)).toBe(1);
    expect(wrongKnocks(hint)).toBe(1);
    // 老模式的账本一个字没改：敲草丛还是敲草丛，试身影还是试身影
    const knocked = knock(knockLevel, probeStart(), 'a');
    expect(knocked.knocked).toEqual(['a']);
    expect(knocked.crossed).toBeNull();
    const tried = shoot(spotLevel, probeStart(), 'f1');
    expect(tried.tried).toEqual(['f1']);
    expect(tried.king).toBeNull();
    expect(isFigureTried(tried, 'f1')).toBe(true);
    // hint 的账本里没有老模式的那几个字段（各记各的）
    expect(Object.keys(hintStart()).sort()).toEqual(
      ['knocked', 'lastKnock', 'lastWasWanted', 'progress', 'wrongKnocks'],
    );
  });
});

