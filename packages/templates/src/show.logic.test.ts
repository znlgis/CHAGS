import { describe, expect, it } from 'vitest';
import { ShowLevelSchema } from './schemas';
import type { ShowLevel } from './schemas';
import {
  SHOW_RATES, aliveShadowIds, aliveShadows, beliefAt, beliefRate, isShadowAlive, isShowDone,
  missingShadows, nextSlotToPaint, paint, paintedAtMs, shadowLeftMs, shadowStrength, showStart,
  slotAt, tick,
} from './show.logic';
import type { ShowState } from './show.logic';

/** 与第 7 计内容 JSON 里的关卡一模一样：船帮一排六个空位 */
const SLOT_XS = [108, 215, 322, 429, 536, 643];
const SLOT_Y = 880;

const level: ShowLevel = ShowLevelSchema.parse({
  mode: 'draw',
  slots: SLOT_XS.map((x, i) => ({ id: 'p' + (i + 1), x, y: SLOT_Y, radius: 62 })),
  fadeMs: 4200,
  needed: 4,
  goal: 100,
  hint: '在空位上把草人立起来，别让它淡掉',
});

/** 一次画上好几个空位（孩子手快的时候就是这样） */
function paintAll(state: ShowState, ids: readonly string[], t: number): ShowState {
  let out = state;
  for (const id of ids) out = paint(out, id, t);
  return out;
}

describe('造势 · 影子会淡掉', () => {
  it('一笔只管 fadeMs：到点就淡掉，得回头补', () => {
    const state = paint(showStart(), 'p1', 0);
    expect(isShadowAlive(level, state, 'p1', 0)).toBe(true);
    expect(isShadowAlive(level, state, 'p1', level.fadeMs - 1)).toBe(true);
    expect(isShadowAlive(level, state, 'p1', level.fadeMs)).toBe(false);
    expect(isShadowAlive(level, state, 'p1', 99999)).toBe(false);
    expect(shadowLeftMs(level, state, 'p1', 1200)).toBe(level.fadeMs - 1200);
    expect(shadowLeftMs(level, state, 'p1', 99999)).toBe(0);
  });

  it('没画过的空位就是空的 —— 开局船上什么都没有', () => {
    const state = showStart();
    expect(aliveShadows(level, state, 0)).toBe(0);
    expect(paintedAtMs(state, 'p1')).toBeNull();
    expect(shadowStrength(level, state, 'p1', 0)).toBe(0);
  });

  it('影子越淡越薄：刚画上是 1，半程 0.5，到点 0', () => {
    const state = paint(showStart(), 'p1', 0);
    expect(shadowStrength(level, state, 'p1', 0)).toBe(1);
    expect(shadowStrength(level, state, 'p1', level.fadeMs / 2)).toBeCloseTo(0.5, 6);
    expect(shadowStrength(level, state, 'p1', level.fadeMs)).toBe(0);
  });

  it('补一笔是**续上**原来的位置，不是多出一个影子', () => {
    const first = paint(showStart(), 'p1', 0);
    const again = paint(first, 'p1', 1000);
    expect(aliveShadows(level, again, 1000)).toBe(1);
    expect(paintedAtMs(again, 'p1')).toBe(1000);
    expect(again.strokes).toBe(2);
  });
});

describe('造势 · 疑心', () => {
  it('影子不够 needed：疑心一直不涨', () => {
    let state = paintAll(showStart(), ['p1', 'p2', 'p3'], 0);
    expect(aliveShadows(level, state, 0)).toBe(3);
    expect(missingShadows(level, state, 0)).toBe(1);
    expect(beliefRate(level, state, 0)).toBe(-SHOW_RATES.fallPerSec);
    for (const t of [1000, 2000, 3000]) state = tick(level, state, t, 1000);
    expect(state.belief).toBe(0);
  });

  it('立够 needed 个：疑心开始涨（每秒涨 risePerSec）', () => {
    let state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    expect(beliefRate(level, state, 0)).toBe(SHOW_RATES.risePerSec);
    state = tick(level, state, 0, 1000);
    expect(state.belief).toBe(SHOW_RATES.risePerSec);
    state = tick(level, state, 1000, 1000);
    expect(state.belief).toBe(SHOW_RATES.risePerSec * 2);
  });

  it('影子淡掉之后疑心回落 —— 不补笔，势就散了', () => {
    let state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    state = tick(level, state, 0, 1000);
    const raised = state.belief;
    expect(raised).toBeGreaterThan(0);

    // 一直不补：过了 fadeMs，四个影子全淡掉了
    state = tick(level, state, 6000, 1000);
    expect(aliveShadows(level, state, 6000)).toBe(0);
    expect(state.belief).toBe(raised - SHOW_RATES.fallPerSec);
    expect(beliefAt(level, state, 7000)).toBeLessThan(raised);

    // 落得比涨得慢：造起来的势不会一下子塌掉
    expect(SHOW_RATES.fallPerSec).toBeLessThan(SHOW_RATES.risePerSec);
  });

  it('零惩罚：影子全淡掉也不结束，补上就又能涨回来', () => {
    let state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    state = tick(level, state, 0, 4000);
    expect(state.belief).toBe(SHOW_RATES.risePerSec * 4);
    state = tick(level, state, 5000, 2000);
    const dropped = state.belief;
    expect(dropped).toBeLessThan(SHOW_RATES.risePerSec * 4);
    expect(isShowDone(level, state)).toBe(false);

    state = paintAll(state, ['p1', 'p2', 'p3', 'p4'], 5000);
    for (const t of [5000, 6000, 7000]) state = tick(level, state, t, 1000);
    expect(state.belief).toBe(dropped + SHOW_RATES.risePerSec * 3);
  });

  it('疑心涨满 goal 就算成 —— 涨满之后封顶，不会冒出去', () => {
    let state = showStart();
    let atMs = 0;
    for (let t = 0; t <= 20_000 && !isShowDone(level, state); t += 1000) {
      const slot = nextSlotToPaint(level, state, t);
      if (slot) state = paint(state, slot.id, t);
      state = tick(level, state, t, 1000);
      atMs = t;
    }
    expect(isShowDone(level, state)).toBe(true);
    expect(state.belief).toBe(level.goal);
    // 七秒多一点的"撑着"就能涨满 —— 难的不是时间，是手不能停
    expect(atMs).toBeGreaterThan(7000);
    expect(state.strokes).toBeGreaterThan(level.needed);

    state = tick(level, state, atMs + 1000, 1000);
    expect(state.belief).toBe(level.goal);
  });
});

describe('造势 · 该补哪一笔', () => {
  it('影子不够时先去立空位', () => {
    const state = paintAll(showStart(), ['p1', 'p2', 'p3'], 0);
    const slot = nextSlotToPaint(level, state, 0);
    expect(slot).toBeDefined();
    expect(isShadowAlive(level, state, slot!.id, 0)).toBe(false);
  });

  it('够了就去续最快要淡掉的那一笔', () => {
    let state = showStart();
    const ids = ['p1', 'p2', 'p3', 'p4'];
    ids.forEach((id, i) => {
      state = paint(state, id, i * 1000);
    });
    expect(aliveShadows(level, state, 3000)).toBe(4);
    expect(nextSlotToPaint(level, state, 3000)!.id).toBe('p1');
    state = paint(state, 'p1', 3000);
    expect(nextSlotToPaint(level, state, 3000)!.id).toBe('p2');
  });

  it('轮转补画：立够之后一步一秒地续，影子一直不少于 needed', () => {
    // 先把 needed 个空位立起来（手快一点），之后每秒只补一笔 —— 刚好跟得上淡掉的速度
    let state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    for (let t = 0; t <= 30_000; t += 1000) {
      const slot = nextSlotToPaint(level, state, t);
      if (slot) state = paint(state, slot.id, t);
      expect(aliveShadows(level, state, t)).toBeGreaterThanOrEqual(level.needed);
      state = tick(level, state, t, 1000);
    }
  });

  it('影子都淡光时，接下来该补的是最早空出来的那个位子', () => {
    const state = paintAll(showStart(), ['p1', 'p2'], 0);
    const slot = nextSlotToPaint(level, state, 99_999);
    expect(slot).toBeDefined();
    expect(aliveShadowIds(level, state, 99_999)).toEqual([]);
  });
});

describe('造势 · 点哪儿', () => {
  it('点中空位就算那一笔；宽容度让小朋友不用对准', () => {
    const first = level.slots[0]!;
    // 船帮下面（y 更靠下）没有别的空位，用来单独验宽容度
    const below = { x: first.x, y: first.y + first.radius + 20 };
    expect(slotAt(level, first.x, first.y)!.id).toBe('p1');
    expect(slotAt(level, below.x, below.y)).toBeUndefined();
    expect(slotAt(level, below.x, below.y, 40)!.id).toBe('p1');
  });

  it('两个空位都在手边时，算最近的那个', () => {
    const [a, b] = [level.slots[0]!, level.slots[1]!];
    const nearB = { x: b.x - 10, y: b.y };
    expect(slotAt(level, nearB.x, nearB.y, 999)!.id).toBe(b.id);
    expect(slotAt(level, a.x, a.y, 999)!.id).toBe(a.id);
  });
});

describe('造势 · 边界', () => {
  it('时间往回走（单测里回看）时，影子按"还没落笔"算，不会崩', () => {
    const state = paint(showStart(), 'p1', 5000);
    expect(isShadowAlive(level, state, 'p1', 1000)).toBe(false);
    expect(aliveShadows(level, state, 1000)).toBe(0);
    expect(shadowLeftMs(level, state, 'p1', 0)).toBe(0);
  });

  it('画到关卡里没有的空位上：不崩，也不影响计数', () => {
    const state = paint(showStart(), 'nowhere', 0);
    expect(state.strokes).toBe(1);
    expect(aliveShadows(level, state, 0)).toBe(0);
  });

  it('疑心落到底就是 0 —— 再久也不会落成负数', () => {
    let state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    state = tick(level, state, 0, 1000);
    state = tick(level, state, 60_000, 60_000);
    expect(state.belief).toBe(0);
    expect(beliefAt(level, state, 120_000)).toBe(0);
  });

  it('无头验证的那条规则能一局走完：每 260ms 补一笔，几秒钟疑心就涨满', () => {
    // 与 show.ts 的 runAutoplay 同一条规则：不够就填空位，够了就续最快要淡的那一笔；
    // 每一帧按 delta × autoplayFactor 记账（场景就是这么喂的）
    let state = showStart();
    let nextPaint = 0;
    let doneAt = -1;
    for (let t = 0; t <= 30_000; t += 16) {
      if (t >= nextPaint) {
        nextPaint = t + 260;
        const slot = nextSlotToPaint(level, state, t);
        if (slot) state = paint(state, slot.id, t);
      }
      state = tick(level, state, t, 16 * SHOW_RATES.autoplayFactor);
      if (isShowDone(level, state)) {
        doneAt = t;
        break;
      }
    }
    expect(doneAt).toBeGreaterThan(0);
    expect(doneAt).toBeLessThan(10_000);
    expect(aliveShadows(level, state, doneAt)).toBeGreaterThanOrEqual(level.needed);
  });

  it('beliefAt 与 tick 对得上：同一段时间，两边算出的疑心一样', () => {
    const state = paintAll(showStart(), ['p1', 'p2', 'p3', 'p4'], 0);
    const preview = beliefAt(level, state, 1500);
    const committed = tick(level, state, 1500, 1500);
    expect(preview).toBeCloseTo(committed.belief, 9);
  });
});
