import { describe, expect, it } from 'vitest';
import { ReadLevelSchema } from './schemas';
import {
  READ_TIMING, applyMiss, applyRead, autoplayLevel, isReadDone, isTellRead, nextTellAt,
  nextTellToRead, readMisses, readProgress, readStart, tellAt, tellAtSlot, tellLeftMs, tellNear,
  tellSlots, tellsSoFar,
} from './read.logic';

/** 第 10 计 · 笑里藏刀：一句话底下六处破绽，只在各自窗口里露一下 */
const level = ReadLevelSchema.parse({
  mode: 'inspect',
  speaker: { x: 375, y: 520 },
  tells: [
    { id: 't1', atMs: 2600, windowMs: 1500, x: 316, y: 462, radius: 74, kind: 'eye' },
    { id: 't2', atMs: 6100, windowMs: 1500, x: 180, y: 762, radius: 80, kind: 'sleeve' },
    { id: 't3', atMs: 9800, windowMs: 1500, x: 300, y: 900, radius: 80, kind: 'finger' },
    { id: 't4', atMs: 13800, windowMs: 1500, x: 430, y: 462, radius: 74, kind: 'eye' },
    { id: 't5', atMs: 17400, windowMs: 1500, x: 572, y: 762, radius: 80, kind: 'sleeve' },
    { id: 't6', atMs: 20800, windowMs: 1500, x: 450, y: 900, radius: 80, kind: 'finger' },
  ],
  goal: 4,
  hint: '好听的话里，留意他的小动作',
});

const t1 = level.tells[0]!;

describe('破绽什么时候看得见', () => {
  it('窗口是左闭右开：露出来的那一刻能看见，收回去的那一刻就没了', () => {
    expect(tellAt(level, 2599)).toBeUndefined();
    expect(tellAt(level, 2600)?.id).toBe('t1');
    expect(tellAt(level, 4099)?.id).toBe('t1');
    expect(tellAt(level, 4100)).toBeUndefined();
    expect(tellAtSlot(level, 2600)?.endMs).toBe(4100);
  });

  it('两处破绽之间什么也没有 —— 这时候点就是点空（零惩罚）', () => {
    expect(tellAt(level, 0)).toBeUndefined();
    expect(tellAt(level, 5000)).toBeUndefined();
    expect(tellAt(level, 12000)).toBeUndefined();
    // 最后一处收回去之后，一直到结束都没有破绽了
    expect(tellAt(level, 22300)).toBeUndefined();
    expect(tellAt(level, 999999)).toBeUndefined();
  });

  it('负数（回看这一局之前）当作 0，不会算出"窗口里的破绽"', () => {
    expect(tellAt(level, -1)).toBeUndefined();
    expect(tellAt(level, -99999)).toBeUndefined();
    expect(tellLeftMs(level, -1)).toBe(0);
    expect(tellsSoFar(level, -1)).toBe(0);
  });

  it('窗口还剩多久：一直数到窗口关上', () => {
    expect(tellLeftMs(level, 2600)).toBe(1500);
    expect(tellLeftMs(level, 4000)).toBe(100);
    expect(tellLeftMs(level, 4100)).toBe(0);
    expect(tellLeftMs(level, 0)).toBe(0);
  });

  it('到这一刻为止露过面几处、下一处是什么时候', () => {
    expect(tellsSoFar(level, 0)).toBe(0);
    expect(tellsSoFar(level, 2600)).toBe(1);
    expect(tellsSoFar(level, 25999)).toBe(6);
    expect(nextTellAt(level, 0)?.id).toBe('t1');
    expect(nextTellAt(level, 2600)?.id).toBe('t2');
    expect(nextTellAt(level, 25000)).toBeUndefined();
  });

  it('时间轴按出现先后排（关卡脚本里 atMs 本来就是递增的）', () => {
    expect(tellSlots(level).map((slot) => slot.tell.id)).toEqual([
      't1', 't2', 't3', 't4', 't5', 't6',
    ]);
    expect(tellSlots(level).map((slot) => slot.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('看穿：同一处只算一次', () => {
  it('点中破绽就记下来', () => {
    const once = applyRead(level, readStart(), 't1');
    expect(once.read).toEqual(['t1']);
    expect(isTellRead(once, 't1')).toBe(true);
    expect(readMisses(once)).toBe(0);
  });

  it('同一个破绽点两次只算一次', () => {
    const once = applyRead(level, readStart(), 't1');
    const twice = applyRead(level, once, 't1');
    expect(twice.read).toEqual(['t1']);
    expect(twice).toBe(once); // 什么都没变：场景据此跳过重复的表演
    const thrice = applyRead(level, applyRead(level, twice, 't1'), 't1');
    expect(thrice.read).toEqual(['t1']);
  });

  it('看穿不同的破绽会累加，顺序就是看穿的先后', () => {
    const state = applyRead(level, applyRead(level, readStart(), 't2'), 't1');
    expect(state.read).toEqual(['t2', 't1']);
    expect(state.read.length).toBe(2);
  });

  it('不存在的破绽 id 什么也不做（内容写错不该在玩法里悄悄算一星）', () => {
    const state = applyRead(level, readStart(), 'ghost');
    expect(state.read).toEqual([]);
    expect(readMisses(state)).toBe(0);
  });
});

describe('点空：零惩罚', () => {
  it('点空只记一次 miss，看穿的数不变', () => {
    const state = applyMiss(applyMiss(readStart()));
    expect(readMisses(state)).toBe(2);
    expect(state.read).toEqual([]);
    expect(isReadDone(level, state)).toBe(false);
  });

  it('点空多少次都不会结束、也不会把看穿的清掉', () => {
    let state = applyRead(level, readStart(), 't1');
    for (let i = 0; i < 50; i += 1) state = applyMiss(state);
    expect(readMisses(state)).toBe(50);
    expect(state.read).toEqual(['t1']);
    // 接着点中还是照常累加 —— 惩罚没有累积成"点不动了"
    expect(applyRead(level, state, 't2').read).toEqual(['t1', 't2']);
  });

  it('miss 与 read 互不干扰：先看穿再点空，还是先点空再看穿', () => {
    const a = applyMiss(applyRead(level, readStart(), 't1'));
    const b = applyRead(level, applyMiss(readStart()), 't1');
    expect(a.read).toEqual(b.read);
    expect(readMisses(a)).toBe(readMisses(b));
  });
});

describe('看懂：看穿 goal 处才算', () => {
  it('差一处也不算看懂', () => {
    let state = readStart();
    for (const id of ['t1', 't2', 't3']) state = applyRead(level, state, id);
    expect(isReadDone(level, state)).toBe(false);
    expect(readProgress(level, state)).toBeCloseTo(0.75);
    state = applyRead(level, state, 't4');
    expect(isReadDone(level, state)).toBe(true);
    expect(readProgress(level, state)).toBe(1);
  });

  it('多看穿几处也没关系（不是"只能点这几下"）', () => {
    let state = readStart();
    for (const tell of level.tells) state = applyRead(level, state, tell.id);
    expect(state.read.length).toBe(6);
    expect(isReadDone(level, state)).toBe(true);
  });

  it('还没看穿任何一处时进度是 0', () => {
    expect(readProgress(level, readStart())).toBe(0);
  });
});

describe('点选：手指粗也能点得到', () => {
  it('点中破绽的圆心与圆圈边缘都算', () => {
    expect(tellNear(level, 316, 462, 0)?.id).toBe('t1');
    expect(tellNear(level, 316 - 74, 462, 0)?.id).toBe('t1');
    expect(tellNear(level, 316 - 74 - 1, 462, 0)).toBeUndefined();
    // 两处眼睛挨得近时，拿最近的那一处
    expect(tellNear(level, 430, 462, 0)?.id).toBe('t4');
  });

  it('离得远就是点空；宽容度让手指粗一点也能点到', () => {
    expect(tellNear(level, 375, 1200, 0)).toBeUndefined();
    expect(tellNear(level, 316, 462 + 74 + 40, 44)?.id).toBe('t1');
    // 两处破绽都不在附近时，给什么宽容度都是点空
    expect(tellNear(level, 375, 1200, 60)).toBeUndefined();
  });

  it('给了墙钟就只认此刻看得见的那一处：窗口外面点它不算', () => {
    expect(tellNear(level, 316, 462, 0, 2600)?.id).toBe('t1');
    expect(tellNear(level, 316, 462, 0, 4200)).toBeUndefined();
    expect(tellNear(level, 316, 462, 0, 6100)).toBeUndefined();
  });

  it('下一个该看哪一处：跳过已经看穿的', () => {
    const state = applyRead(level, readStart(), 't1');
    expect(nextTellToRead(level, state)?.id).toBe('t2');
    expect(nextTellToRead(level, state, 2)?.id).toBe('t3');
    let all = readStart();
    for (const tell of level.tells) all = applyRead(level, all, tell.id);
    expect(nextTellToRead(level, all)).toBeUndefined();
  });
});

describe('无头验证：把破绽出现的时刻压短', () => {
  it('真实操作时关卡原样不动', () => {
    expect(autoplayLevel(level, false)).toBe(level);
  });

  it('压短之后仍然严格递增、窗口还点得到', () => {
    const fast = autoplayLevel(level, true);
    for (let i = 1; i < fast.tells.length; i += 1) {
      expect(fast.tells[i]!.atMs).toBeGreaterThan(fast.tells[i - 1]!.atMs);
    }
    for (const tell of fast.tells) {
      expect(tell.windowMs).toBeGreaterThanOrEqual(READ_TIMING.autoplayMinWindowMs);
      expect(tell.atMs).toBeLessThanOrEqual(level.tells[5]!.atMs + 3000);
    }
    // id / 坐标 / 半径这些"内容"一个都不许变
    expect(fast.tells.map((tell) => tell.id)).toEqual(level.tells.map((tell) => tell.id));
    expect(fast.tells.map((tell) => tell.x)).toEqual(level.tells.map((tell) => tell.x));
    expect(fast.goal).toBe(level.goal);
    expect(fast.speaker).toEqual(level.speaker);
  });

  it('压短之后每一处都真的会露面，而且互不重叠', () => {
    const fast = autoplayLevel(level, true);
    const seen: string[] = [];
    for (let t = 0; t < 20000; t += 10) {
      for (const tell of level.tells) {
        if (tellAt(fast, t)?.id === tell.id && !seen.includes(tell.id)) seen.push(tell.id);
      }
    }
    expect(seen).toEqual(level.tells.map((tell) => tell.id));
  });

  it('一局真的走得完：加上无头验证的"隔一会儿看一眼"，六处都能看穿', () => {
    const fast = autoplayLevel(level, true);
    let state = readStart();
    for (let t = 0; t < 20000 && !isReadDone(fast, state); t += READ_TIMING.autoplayLookMs) {
      const tell = tellAt(fast, t);
      if (tell === undefined || isTellRead(state, tell.id)) continue;
      // 与真实操作完全同一条路：先按下（点空就记一次 miss），再 applyRead
      if (tellNear(fast, tell.x, tell.y, 0, t) === undefined) {
        state = applyMiss(state);
        continue;
      }
      state = applyRead(fast, state, tell.id);
    }
    expect(isReadDone(fast, state)).toBe(true);
    expect(readMisses(state)).toBe(0);
  });
});

describe('schema：破绽的账自己记得住（这一关必须有解）', () => {
  it('atMs 必须递增 —— 否则"此刻该看哪儿"就算不出来', () => {
    expect(() =>
      ReadLevelSchema.parse({
        ...level,
        tells: [level.tells[0]!, { ...level.tells[1]!, atMs: 2600 }],
      }),
    ).toThrow();
    expect(() =>
      ReadLevelSchema.parse({
        ...level,
        tells: [level.tells[1]!, level.tells[0]!],
      }),
    ).toThrow();
  });

  it('要看穿的破绽不能比出现的还多', () => {
    expect(() => ReadLevelSchema.parse({ ...level, goal: 7 })).toThrow();
    expect(() => ReadLevelSchema.parse({ ...level, goal: 6 })).not.toThrow();
  });

  it('破绽的 id 不能重复', () => {
    expect(() =>
      ReadLevelSchema.parse({
        ...level,
        tells: [level.tells[0]!, { ...level.tells[1]!, id: 't1' }],
      }),
    ).toThrow();
  });

  it('关卡脚本里那一处破绽长什么样（与内容 JSON 共用的口径）', () => {
    expect(t1).toMatchObject({ atMs: 2600, windowMs: 1500, kind: 'eye', radius: 74 });
    expect(level.goal).toBe(4);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });
});

describe('无头验证：一局真的走得完（照模板 runAutoplay 的同一条路）', () => {
  it('按墙钟一眼一眼地看：直到看懂为止，中途一次空点都没有', () => {
    const fast = autoplayLevel(level, true);
    let state = readStart();
    const readOrder: string[] = [];
    // 模板的无头验证就是这一条循环：每 autoplayLookMs 看一眼 tellAt，有就 tellNear + applyRead
    for (let t = 0; t < 12000 && !isReadDone(fast, state); t += READ_TIMING.autoplayLookMs) {
      const tell = tellAt(fast, t);
      if (tell === undefined || isTellRead(state, tell.id)) continue;
      if (tellNear(fast, tell.x, tell.y, 36, t) === undefined) {
        state = applyMiss(state);
        continue;
      }
      const before = state;
      state = applyRead(fast, state, tell.id);
      expect(state.read.length).toBe(before.read.length + 1);
      readOrder.push(tell.id);
      // 同一个破绽再看一次不会多算
      expect(applyRead(fast, state, tell.id)).toBe(state);
    }
    expect(isReadDone(fast, state)).toBe(true);
    expect(state.read.length).toBe(fast.goal);
    expect(readOrder).toEqual(['t1', 't2', 't3', 't4']);
    expect(readMisses(state)).toBe(0);
  });

  it('看懂之后画面上就结束了：sparkle + 揭晓语 + 进典故卡', () => {
    const fast = autoplayLevel(level, true);
    let state = readStart();
    for (let t = 0; t < 12000 && !isReadDone(fast, state); t += 10) {
      const tell = tellAt(fast, t);
      if (tell) state = applyRead(fast, state, tell.id);
    }
    expect(isReadDone(fast, state)).toBe(true);
    expect(readProgress(fast, state)).toBe(1);
  });
});
