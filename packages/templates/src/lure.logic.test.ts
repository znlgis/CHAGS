import { describe, expect, it } from 'vitest';
import { LureDecoySchema, LureTradeSchema } from './schemas';
import {
  LURE_TIMING, awayLeftMs, awayTotalMs, baitAt, baitById, baitsLongEnough, bestBait, bestOffer,
  decoyStart, givenReturnFor, give, grabAt, grabProgress, guardBack, isAway, isDecoyDone,
  isTradeDone, lureAutoplayLevel, lureStart, nextOfferToGive, offerAt, offerById, offerFor,
  placeBait, prizeHit, releaseGrab, tradeProgress, tradeStart,
} from './lure.logic';
import type { LureDecoyLevel, LureDecoyState, LureTradeLevel, LureTradeState } from './lure.logic';
// 第六辑 · 第 31 计 美人计（favor）：新判定单独 import —— 上面老模式那几行一行没动
import { LureFavorSchema } from './schemas';
import type { LureFavorLevel } from './schemas';
import {
  FAVOR_TIMING, favorProgress, favorStart, favorsGiven, gazeAt, giftAt, giftById, glanceAt,
  glanceCycleMs, glanceLeftMs, glanceOtherMs, glanceMs, glancePlan, hintGift, isFavorDone,
  nextGiftToOffer, offerFavor, wantedGift,
} from './lure.logic';

/** 第 15 计 · 调虎离山：三个诱饵点，只有一个够久的那两个拿得走 */
const decoy: LureDecoyLevel = LureDecoySchema.parse({
  mode: 'decoy',
  guard: { x: 375, y: 520, radius: 96 },
  baits: [
    { id: 'b1', x: 150, y: 350, radius: 66, awayMs: 3200 },
    { id: 'b2', x: 375, y: 292, radius: 66, awayMs: 5200 },
    { id: 'b3', x: 614, y: 372, radius: 66, awayMs: 7000 },
  ],
  prize: { x: 560, y: 1000, radius: 100, needMs: 4800 },
  hint: '放个诱饵把他引开，按住箱子',
});

/** 第 17 计 · 抛砖引玉：三块砖，最不起眼的那块（纸）换回最多 */
const trade: LureTradeLevel = LureTradeSchema.parse({
  mode: 'trade',
  partner: { x: 375, y: 560 },
  offers: [
    { id: 'paper', x: 170, y: 1010, radius: 88, kind: 'paper' },
    { id: 'ink', x: 375, y: 1010, radius: 88, kind: 'ink' },
    { id: 'brush', x: 580, y: 1010, radius: 88, kind: 'brush' },
  ],
  returns: [
    { offerId: 'paper', kind: 'poem', value: 6 },
    { offerId: 'ink', kind: 'couplet', value: 3 },
    { offerId: 'brush', kind: 'note', value: 2 },
  ],
  needed: 6,
  hint: '先递一样东西，看他换回什么',
});

const STEP = 16;

/**
 * 照模板 tick 的同一条路走一局：放下诱饵后每一帧都按住箱子（grabAt），
 * 看守到点就回岗（guardBack）。返回记账到哪一刻、那一刻的账本。
 */
function hold(
  level: LureDecoyLevel,
  baitId: string,
  stepMs = STEP,
): { state: LureDecoyState; t: number } {
  let state = placeBait(level, decoyStart(), baitId, 0);
  let t = 0;
  while (t < 60000 && !isDecoyDone(level, state)) {
    state = guardBack(level, state, t);
    if (state.baitId === null) break;
    state = grabAt(level, state, t);
    t += stepMs;
  }
  return { state, t };
}

/** 一刻不停地按到第 ms 毫秒（每帧记一次账，和场景跑起来一模一样） */
function holdFor(
  level: LureDecoyLevel,
  baitId: string,
  ms: number,
  stepMs = STEP,
): LureDecoyState {
  let state = placeBait(level, decoyStart(), baitId, 0);
  for (let t = 0; t < ms; t += stepMs) state = grabAt(level, state, t);
  return grabAt(level, state, ms);
}

describe('调虎离山 · 空档是左闭右开的', () => {
  it('放下诱饵：看守离岗，空档从这一刻往回数', () => {
    const state = placeBait(decoy, decoyStart(), 'b3', 1000);
    expect(state.baitId).toBe('b3');
    expect(state.usedBaits).toEqual(['b3']);
    expect(isAway(decoy, state, 1000)).toBe(true);
    expect(awayLeftMs(decoy, state, 1000)).toBe(7000);
    expect(awayLeftMs(decoy, state, 3000)).toBe(5000);
    expect(awayTotalMs(decoy, state)).toBe(7000);
  });

  it('空档一过看守就回来了（左闭右开）', () => {
    const state = placeBait(decoy, decoyStart(), 'b1', 0);
    expect(awayLeftMs(decoy, state, 3199)).toBe(1);
    expect(awayLeftMs(decoy, state, 3200)).toBe(0);
    expect(isAway(decoy, state, 3200)).toBe(false);
    expect(awayLeftMs(decoy, state, 99999)).toBe(0);
    expect(awayTotalMs(decoy, state)).toBe(3200);
  });

  it('还没放诱饵时：岗位是满的，点箱子什么也没有', () => {
    const state = decoyStart();
    expect(awayLeftMs(decoy, state, 5000)).toBe(0);
    expect(isAway(decoy, state, 5000)).toBe(false);
    expect(grabAt(decoy, state, 5000).grabMs).toBe(0);
    expect(awayTotalMs(decoy, state)).toBe(0);
  });

  it('回看这一局之前（t 比放下诱饵还早）按"空档还满着"算，不会算出负数', () => {
    const state = placeBait(decoy, decoyStart(), 'b2', 5000);
    expect(awayLeftMs(decoy, state, 1000)).toBe(5200);
    expect(grabAt(decoy, state, -9999).grabMs).toBe(0);
  });
});

describe('调虎离山 · 要挑能空够久的那个诱饵点', () => {
  it('够长的诱饵点就是那几个 —— "哪个才行"是内容数据说了算的', () => {
    expect(baitsLongEnough(decoy).map((bait) => bait.id)).toEqual(['b2', 'b3']);
    expect(bestBait(decoy)?.id).toBe('b2'); // 够长的里面最短的那个（刚好够用）
    expect(bestBait(decoy)?.awayMs).toBeGreaterThanOrEqual(decoy.prize.needMs);
  });

  it('选错诱饵点：空档就那么长，永远拿不走', () => {
    // 一刻不停地按满整个 3200 的空档
    let state = placeBait(decoy, decoyStart(), 'b1', 0);
    let t = 0;
    while (isAway(decoy, state, t)) {
      state = grabAt(decoy, state, t);
      t += STEP;
    }
    expect(state.grabMs).toBe(3184);
    expect(decoy.prize.needMs - state.grabMs).toBeGreaterThan(0); // 差的那截永远补不上
    expect(isDecoyDone(decoy, state)).toBe(false);

    // 看守回来，没拿完的清零
    const back = guardBack(decoy, state, t);
    expect(back.returns).toBe(1);
    expect(back.grabMs).toBe(0);
    expect(back.done).toBe(false);
    expect(grabProgress(decoy, back)).toBe(0);
  });

  it('选对诱饵点：连续按住 needMs 就拿走', () => {
    const { state, t } = hold(decoy, 'b2');
    expect(isDecoyDone(decoy, state)).toBe(true);
    expect(state.grabMs).toBe(decoy.prize.needMs);
    expect(grabProgress(decoy, state)).toBe(1);
    // 5200 的空档里只用了 4800：还剩 400 毫秒的余地
    expect(t).toBeGreaterThanOrEqual(4800);
    expect(t).toBeLessThanOrEqual(5200);
    expect(awayLeftMs(decoy, state, t)).toBeGreaterThan(0);
  });

  it('最久的那个诱饵点当然也拿得走（多等一会儿而已）', () => {
    const { state } = hold(decoy, 'b3');
    expect(isDecoyDone(decoy, state)).toBe(true);
    expect(state.grabMs).toBe(4800);
  });

  it('拿到几成看得见：一半就是一半', () => {
    const half = holdFor(decoy, 'b2', 2400);
    expect(grabProgress(decoy, half)).toBeCloseTo(0.5);
    expect(isDecoyDone(decoy, half)).toBe(false);
    expect(grabProgress(decoy, holdFor(decoy, 'b2', 4800))).toBe(1);
  });
});

describe('调虎离山 · 看守回来清零，但可以再来（零惩罚）', () => {
  it('没拿完就回岗：空档里的进度清零，记一笔"回来了"', () => {
    const state = holdFor(decoy, 'b2', 3000);
    expect(state.grabMs).toBe(3000);
    const back = guardBack(decoy, state, 5200);
    expect(back.baitId).toBeNull();
    expect(back.grabMs).toBe(0);
    expect(back.returns).toBe(1);
    expect(back.lastReturnAtMs).toBe(5200);
    expect(isDecoyDone(decoy, back)).toBe(false);
    expect(back.usedBaits).toEqual(['b2']); // 试过什么记着，别的什么都不扣
  });

  it('空档还没到点，guardBack 不会误伤（还在离岗就是还在离岗）', () => {
    const state = placeBait(decoy, decoyStart(), 'b2', 0);
    expect(guardBack(decoy, state, 5199)).toBe(state);
    expect(guardBack(decoy, decoyStart(), 9999).returns).toBe(0); // 本来就在岗：不记
  });

  it('清零之后换一个诱饵点，照样能拿 —— 重来多少次都行', () => {
    let state = hold(decoy, 'b1').state; // 第一次选错
    expect(state.returns).toBe(1);
    state = placeBait(decoy, state, 'b3', 4000);
    expect(isAway(decoy, state, 4000)).toBe(true);
    let t = 4000;
    while (!isDecoyDone(decoy, state)) {
      state = guardBack(decoy, state, t);
      state = grabAt(decoy, state, t);
      t += STEP;
    }
    expect(isDecoyDone(decoy, state)).toBe(true);
    expect(state.returns).toBe(1); // 一次教训，不算失败
    expect(state.usedBaits).toEqual(['b1', 'b3']);
  });

  it('同一关可以一直重来：连错三次也只是三次"回来了"', () => {
    let state = decoyStart();
    let t = 0;
    for (const id of ['b1', 'b1', 'b1']) {
      state = placeBait(decoy, state, id, t);
      while (isAway(decoy, state, t)) {
        state = grabAt(decoy, state, t);
        t += STEP;
      }
      state = guardBack(decoy, state, t);
    }
    expect(state.returns).toBe(3);
    expect(state.done).toBe(false);
    // 手上还是那副牌：换一个够长的诱饵点，立刻就能重来
    expect(placeBait(decoy, state, 'b3', t).baitId).toBe('b3');
  });
});

describe('调虎离山 · 守卫在岗 / 松手 / 连点诱饵：都是零惩罚', () => {
  it('看守在岗时按住箱子：什么都不发生（不扣星、不结束）', () => {
    let state = decoyStart();
    for (let t = 0; t < 5000; t += STEP) state = grabAt(decoy, state, t);
    expect(state.grabMs).toBe(0);
    expect(state.done).toBe(false);
    expect(state.returns).toBe(0);
    expect(state.usedBaits).toEqual([]);
  });

  it('松手的那段不算"连续的空档"', () => {
    let state = holdFor(decoy, 'b3', 1000);
    expect(state.grabMs).toBe(1000);
    expect(state.holding).toBe(true);
    state = releaseGrab(state, 1000);
    expect(state.holding).toBe(false);
    // 没按着的时候场景每帧都调 releaseGrab：它幂等，什么也不改
    const idle = releaseGrab(releaseGrab(state, 1200), 2000);
    expect(idle).toBe(state);
    // 松手两秒之后再按住：从按住这一刻重新算起
    state = grabAt(decoy, idle, 3000);
    expect(state.grabMs).toBe(1000);
    expect(state.holding).toBe(true);
    state = grabAt(decoy, state, 4000);
    expect(state.grabMs).toBe(2000);
    expect(isDecoyDone(decoy, state)).toBe(false);
  });

  it('空档里再放一个诱饵不管用 —— 不能靠连点把空档续下去', () => {
    const first = placeBait(decoy, decoyStart(), 'b3', 0);
    const second = placeBait(decoy, first, 'b3', 3000);
    expect(second).toBe(first); // 原样返回：连"记一笔"都没有
    const other = placeBait(decoy, first, 'b2', 3000);
    expect(other).toBe(first);
    expect(awayLeftMs(decoy, first, 3000)).toBe(4000); // 还是那 7000 减去 3000
    expect(first.usedBaits).toEqual(['b3']);
  });

  it('窗口过了之后（guardBack 之前）重新放诱饵：允许，而且从此刻重新计时', () => {
    const first = placeBait(decoy, decoyStart(), 'b1', 0);
    const again = placeBait(decoy, first, 'b3', 3200);
    expect(again).not.toBe(first);
    expect(again.baitId).toBe('b3');
    expect(again.grabMs).toBe(0);
    expect(awayLeftMs(decoy, again, 3200)).toBe(7000);
  });

  it('不存在的诱饵点：什么也不做（内容写错不该在玩法里悄悄生效）', () => {
    const state = decoyStart();
    expect(placeBait(decoy, state, 'ghost', 0)).toBe(state);
    expect(placeBait(decoy, state, 'ghost', 0).baitId).toBeNull();
    expect(baitById(decoy, 'ghost')).toBeUndefined();
    expect(baitById(decoy, null)).toBeUndefined();
  });

  it('拿到之后就不再记账了（这一局结束了）', () => {
    const { state } = hold(decoy, 'b2');
    const after = grabAt(decoy, state, 999999);
    expect(after).toBe(state);
    expect(placeBait(decoy, state, 'b3', 999999)).toBe(state);
  });
});

describe('调虎离山 · 点选：手指粗也能点得到', () => {
  it('点诱饵点：圆心与边缘都算，离得远就是没点着', () => {
    expect(baitAt(decoy, 150, 350)?.id).toBe('b1');
    expect(baitAt(decoy, 150 + 66, 350)?.id).toBe('b1');
    expect(baitAt(decoy, 150 + 67, 350)).toBeUndefined();
    expect(baitAt(decoy, 150 + 66 + 40, 350, 44)?.id).toBe('b1');
    expect(baitAt(decoy, 375, 1200)).toBeUndefined();
  });

  it('点箱子：按住它才拿得动', () => {
    expect(prizeHit(decoy, 560, 1000)).toBe(true);
    expect(prizeHit(decoy, 560 + 100, 1000)).toBe(true);
    expect(prizeHit(decoy, 560, 1000 + 160)).toBe(false);
    expect(prizeHit(decoy, 560, 1000 + 160, 60)).toBe(true);
    expect(prizeHit(decoy, 100, 300)).toBe(false);
  });
});

describe('抛砖引玉 · 每块砖都能查到它换回什么', () => {
  it('三块砖都有对应的"玉"，查不存在的 id 就没有', () => {
    for (const offer of trade.offers) {
      expect(offerFor(trade, offer.id)?.offerId).toBe(offer.id);
    }
    expect(trade.returns.map((item) => item.value)).toEqual([6, 3, 2]);
    expect(offerFor(trade, 'ghost')).toBeUndefined();
    expect(offerById(trade, 'paper')?.kind).toBe('paper');
    expect(offerById(trade, 'ghost')).toBeUndefined();
  });

  it('换回最多的是纸 —— 最不起眼的那一块', () => {
    expect(bestOffer(trade)?.id).toBe('paper');
    expect(offerFor(trade, bestOffer(trade)?.id ?? '')?.value).toBeGreaterThanOrEqual(trade.needed);
  });
});

describe('抛砖引玉 · 挑错了只是再挑一次（零惩罚）', () => {
  it('挑错一块：只记一笔，不算失败', () => {
    const state = give(trade, tradeStart(), 'brush');
    expect(state.given).toEqual(['brush']);
    expect(state.gives).toBe(1);
    expect(state.best).toBe(2);
    expect(state.lastReturn?.kind).toBe('note');
    expect(isTradeDone(trade, state)).toBe(false);
    expect(tradeProgress(trade, state)).toBeCloseTo(2 / 6);
  });

  it('挑错了还能接着挑：三块都递过，最后一块换回玉', () => {
    let state = give(trade, tradeStart(), 'brush');
    state = give(trade, state, 'ink');
    expect(state.best).toBe(3);
    expect(isTradeDone(trade, state)).toBe(false);
    state = give(trade, state, 'paper');
    expect(isTradeDone(trade, state)).toBe(true);
    expect(state.best).toBe(6);
    expect(state.given).toEqual(['brush', 'ink', 'paper']);
    expect(state.gives).toBe(3);
    expect(tradeProgress(trade, state)).toBe(1);
  });

  it('挑对一块就判成功（换到的 value >= needed）', () => {
    const state = give(trade, tradeStart(), 'paper');
    expect(isTradeDone(trade, state)).toBe(true);
    expect(state.lastReturn?.kind).toBe('poem');
  });

  it('同一块砖递两次：记两笔，换回来的东西不变（不是刷分的地方）', () => {
    const once = give(trade, tradeStart(), 'ink');
    const twice = give(trade, once, 'ink');
    expect(twice.gives).toBe(2);
    expect(twice.given).toEqual(['ink', 'ink']);
    expect(twice.best).toBe(once.best);
    expect(isTradeDone(trade, twice)).toBe(false);
  });

  it('不存在的砖：原样返回（场景据此跳过表演）', () => {
    const state = tradeStart();
    expect(give(trade, state, 'ghost')).toBe(state);
    expect(state.given).toEqual([]);
    expect(state.gives).toBe(0);
  });

  it('没递过的不揭晓；递过了才把换回来的东西摆出来', () => {
    const state = give(trade, tradeStart(), 'ink');
    expect(givenReturnFor(trade, state, 'ink')?.kind).toBe('couplet');
    expect(givenReturnFor(trade, state, 'paper')).toBeNull();
  });

  it('小手先指还没递过的那一块 —— 但不告诉孩子哪块换回最多', () => {
    expect(nextOfferToGive(trade, tradeStart())?.id).toBe('paper');
    const state = give(trade, tradeStart(), 'paper');
    expect(nextOfferToGive(trade, state)?.id).toBe('ink');
    let all = tradeStart();
    for (const offer of trade.offers) all = give(trade, all, offer.id);
    expect(nextOfferToGive(trade, all)).toBeUndefined();
  });
});

describe('抛砖引玉 · 点选：手指粗也能点得到', () => {
  it('三块砖的圆心与边缘都算，离得远就是没点着', () => {
    expect(offerAt(trade, 170, 1010)?.id).toBe('paper');
    expect(offerAt(trade, 375 - 88, 1010)?.id).toBe('ink');
    expect(offerAt(trade, 580, 1010 + 88)?.id).toBe('brush');
    expect(offerAt(trade, 375, 1010 + 89)).toBeUndefined();
    expect(offerAt(trade, 375, 300)).toBeUndefined();
    expect(offerAt(trade, 375 + 130, 1010, 44)?.id).toBe('brush');
  });
});

describe('开局：两种模式各有一套账本', () => {
  it('decoy 的开局是"看守在岗"，trade 的开局是"还没递过"', () => {
    const decoyState = lureStart(decoy) as LureDecoyState;
    expect(decoyState.mode).toBe('decoy');
    expect(decoyState.baitId).toBeNull();
    expect(decoyState.grabMs).toBe(0);
    expect(isDecoyDone(decoy, decoyState)).toBe(false);

    const tradeState = lureStart(trade) as LureTradeState;
    expect(tradeState.mode).toBe('trade');
    expect(tradeState.given).toEqual([]);
    expect(tradeState.best).toBe(0);
    expect(isTradeDone(trade, tradeState)).toBe(false);
  });
});

describe('无头验证：一局真的走得完（照模板 runAutoplay 的同一条路）', () => {
  it('真实操作时关卡原样不动', () => {
    expect(lureAutoplayLevel(decoy, false)).toBe(decoy);
    expect(lureAutoplayLevel(trade, false)).toBe(trade);
    expect(lureAutoplayLevel(decoy, true, 1)).toBe(decoy);
  });

  it('把空档与"要连续拿多久"一起压短：够不够长的关系不变', () => {
    const fast = lureAutoplayLevel(decoy, true) as LureDecoyLevel;
    expect(fast.baits.map((bait) => bait.id)).toEqual(['b1', 'b2', 'b3']);
    expect(fast.baits.map((bait) => bait.awayMs)).toEqual([900, 1300, 1750]);
    expect(fast.prize.needMs).toBe(1200);
    // 本来够长的还够长，本来不够的还是不够
    expect(baitsLongEnough(fast).map((bait) => bait.id)).toEqual(['b2', 'b3']);
    expect(baitsLongEnough(decoy).map((bait) => bait.id)).toEqual(['b2', 'b3']);
    // 内容一个都不许变
    expect(fast.prize.x).toBe(decoy.prize.x);
    expect(fast.guard).toEqual(decoy.guard);
    expect(fast.hint).toBe(decoy.hint);
  });

  it('decoy：先选够长的那个诱饵点，再按住箱子 —— 一局走完', () => {
    const fast = lureAutoplayLevel(decoy, true) as LureDecoyLevel;
    const bait = bestBait(fast);
    expect(bait?.id).toBe('b2');
    let state = placeBait(fast, decoyStart(), bait?.id ?? '', 0);
    let t = 0;
    while (!isDecoyDone(fast, state)) {
      state = guardBack(fast, state, t);
      state = grabAt(fast, state, t);
      t += STEP;
      expect(t).toBeLessThan(10000); // 绝不会转不完
    }
    expect(isDecoyDone(fast, state)).toBe(true);
    expect(state.returns).toBe(0); // 一次都没被打断
    expect(t).toBeLessThanOrEqual(LURE_TIMING.finaleHoldMs);
    expect(grabProgress(fast, state)).toBe(1);
  });

  it('trade：直接递 value 最大的那块砖 —— 一次就成', () => {
    const offer = bestOffer(trade);
    const state = give(trade, tradeStart(), offer?.id ?? '');
    expect(isTradeDone(trade, state)).toBe(true);
    expect(state.gives).toBe(1);
  });
});

describe('schema：这一关必须有解（内容写错不该等孩子玩到一半才发现）', () => {
  it('一个能空够久的诱饵点都没有 → 直接报错', () => {
    expect(() =>
      LureDecoySchema.parse({
        ...decoy,
        baits: decoy.baits.map((bait) => ({ ...bait, awayMs: 3200 })),
      }),
    ).toThrow();
  });

  it('诱饵点 id 不能重复', () => {
    expect(() =>
      LureDecoySchema.parse({
        ...decoy,
        baits: [decoy.baits[0]!, { ...decoy.baits[1]!, id: 'b1' }],
      }),
    ).toThrow();
  });

  it('有一样东西递过去没人接 → 直接报错', () => {
    expect(() =>
      LureTradeSchema.parse({
        ...trade,
        returns: trade.returns.filter((item) => item.offerId !== 'brush'),
      }),
    ).toThrow();
  });

  it('怎么换都到不了 needed → 直接报错', () => {
    expect(() =>
      LureTradeSchema.parse({
        ...trade,
        returns: trade.returns.map((item) => ({ ...item, value: 2 })),
      }),
    ).toThrow();
  });

  it('关卡脚本里长什么样（与内容 JSON 共用的口径）', () => {
    expect(decoy.prize).toMatchObject({ x: 560, y: 1000, radius: 100, needMs: 4800 });
    expect(decoy.guard).toMatchObject({ x: 375, y: 520, radius: 96 });
    expect(trade.needed).toBe(6);
    expect(decoy.hint.length).toBeLessThanOrEqual(24);
    expect(trade.hint.length).toBeLessThanOrEqual(24);
  });
});

// ---------------- 第六辑 · 第 31 计 美人计（favor）：上面那一份老模式的测试一个字没动 ----------------

/** 第 31 计 · 美人计：手里三样东西，他最在意的是丝绸 —— 线索只在他的目光里 */
const favor: LureFavorLevel = LureFavorSchema.parse({
  mode: 'favor',
  gifts: [
    { id: 'horse', x: 170, y: 1010, radius: 88, kind: 'horse', speak: '这匹骏马跑得飞快' },
    { id: 'silk', x: 375, y: 1010, radius: 88, kind: 'silk', speak: '这匹丝绸又轻又软' },
    { id: 'sword', x: 580, y: 1010, radius: 88, kind: 'sword', speak: '这口宝剑亮闪闪的' },
  ],
  target: { x: 375, y: 520, radius: 96, wants: 'silk' },
  needOffers: 1,
  refuseLine: '他把东西还了回来',
  hint: '先看他在看什么，再送那一样',
});

/** 把一整圈的目光按 50 毫秒采一遍：每一样东西各被看了多久（教学点的机器验法） */
function gazeTotals(level: LureFavorLevel): Record<string, number> {
  const totals: Record<string, number> = {};
  const step = 50;
  for (let t = 0; t < glanceCycleMs(level); t += step) {
    const gaze = glanceAt(level, t);
    if (gaze === null) continue;
    totals[gaze.id] = (totals[gaze.id] ?? 0) + step;
  }
  return totals;
}

describe('美人计 · 教育点：他的目光落在最在意的那一样上（"先弄清别人在意什么"）', () => {
  it('一个周期：先落在它上面（最长），再把另外两样各扫一眼，最后看别处', () => {
    const plan = glancePlan(favor);
    expect(plan.map((step) => step.gift?.id ?? 'away')).toEqual(['silk', 'horse', 'sword', 'away']);
    expect(plan.map((step) => step.ms)).toEqual([
      glanceMs, glanceOtherMs, glanceOtherMs, FAVOR_TIMING.glanceAwayMs,
    ]);
    expect(glanceCycleMs(favor)).toBe(glanceMs + glanceOtherMs * 2 + FAVOR_TIMING.glanceAwayMs);
  });

  it('被看得最久的就是他在意的那一样 —— 而且比别的东西久得多（看得出来，不是猜出来）', () => {
    const totals = gazeTotals(favor);
    const wanted = wantedGift(favor);
    expect(wanted?.id).toBe('silk');
    expect(wanted?.kind).toBe(favor.target.wants);
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    expect(ranked[0]?.[0]).toBe('silk');
    for (const gift of favor.gifts) {
      if (gift.id === 'silk') continue;
      expect(totals['silk']!).toBeGreaterThanOrEqual((totals[gift.id] ?? 0) * 3);
    }
  });

  it('目光周期性回到它上面：一圈走完还是它（t 回看开局前也算一圈的开头）', () => {
    const cycle = glanceCycleMs(favor);
    expect(glanceAt(favor, 0)?.id).toBe('silk');
    expect(glanceAt(favor, cycle)?.id).toBe('silk');
    expect(glanceAt(favor, cycle * 3)?.id).toBe('silk');
    expect(glanceAt(favor, -1000)?.id).toBe('silk');
  });

  it('看着别处的时候就是"谁也没看"（null）—— 不许随便指一样冒充', () => {
    const away = glanceCycleMs(favor) - 10;
    expect(glanceAt(favor, away)).toBeNull();
    expect(gazeAt(favor, away).gift).toBeNull();
  });

  it('每一段都是左闭右开：剩下的时间一路减到 0，再切到下一段', () => {
    expect(glanceLeftMs(favor, 0)).toBe(glanceMs);
    expect(glanceLeftMs(favor, glanceMs - 1)).toBe(1);
    expect(glanceLeftMs(favor, glanceMs)).toBe(glanceOtherMs);
    expect(gazeAt(favor, glanceMs).gift?.id).toBe('horse');
    expect(gazeAt(favor, glanceMs).totalMs).toBe(glanceOtherMs);
  });

  it('换一样 wants，他就盯着换的那一样 —— 线索只来自关卡数据，不写死在代码里', () => {
    const sword = LureFavorSchema.parse({
      ...favor,
      target: { ...favor.target, wants: 'sword' },
    });
    expect(wantedGift(sword)?.id).toBe('sword');
    expect(glanceAt(sword, 0)?.id).toBe('sword');
    const totals = gazeTotals(sword);
    expect(totals['sword']!).toBeGreaterThan(totals['silk'] ?? 0);
    expect(totals['sword']!).toBeGreaterThan(totals['horse'] ?? 0);
  });
});

describe('美人计 · 先看清他在意什么，再送对那一样', () => {
  it('送对一样：他收下了（kind 对上 wants 才算）', () => {
    const state = favorStart();
    expect(offerFavor(favor, state, 'silk')).toBe('loved');
    expect(favorsGiven(state)).toBe(1);
    expect(state.lastLoved).toBe(true);
    expect(state.offered).toEqual(['silk']);
    expect(isFavorDone(favor, state)).toBe(true);
    expect(favorProgress(favor, state)).toBe(1);
  });

  it('送错：东西回到手里，只多记一笔 —— 不扣星、不结束（零惩罚）', () => {
    const state = favorStart();
    expect(offerFavor(favor, state, 'sword')).toBe('refused');
    expect(state.lastLoved).toBe(false);
    expect(favorsGiven(state)).toBe(0);
    expect(state.offered).toEqual(['sword']);
    expect(state.offers).toBe(1);
    expect(isFavorDone(favor, state)).toBe(false);
    expect(favorProgress(favor, state)).toBe(0);
    // 三样都试过（同一样也可以再送一遍）也只是三笔账
    expect(offerFavor(favor, state, 'horse')).toBe('refused');
    expect(offerFavor(favor, state, 'sword')).toBe('refused');
    expect(state.offers).toBe(3);
    expect(state.offered).toEqual(['sword', 'horse', 'sword']);
    expect(favorsGiven(state)).toBe(0);
    expect(isFavorDone(favor, state)).toBe(false);
  });

  it('送错之后照样能送对：这一关永远不会被关掉', () => {
    const state = favorStart();
    offerFavor(favor, state, 'horse');
    offerFavor(favor, state, 'sword');
    expect(offerFavor(favor, state, 'silk')).toBe('loved');
    expect(isFavorDone(favor, state)).toBe(true);
    expect(state.offers).toBe(3);
    expect(favorsGiven(state)).toBe(1);
  });

  it('不存在的礼物 / 已经打动他之后：什么都不改', () => {
    const state = favorStart();
    expect(offerFavor(favor, state, 'ghost')).toBe('refused');
    expect(state.offers).toBe(0);
    expect(state.offered).toEqual([]);
    expect(giftById(favor, 'ghost')).toBeUndefined();
    expect(offerFavor(favor, state, 'silk')).toBe('loved');
    const after = { ...state, offered: [...state.offered] };
    expect(offerFavor(favor, state, 'horse')).toBe('refused');
    expect(state).toEqual(after);
  });

  it('needOffers 2：要送对两次才打动他（内容是数据说了算的）', () => {
    const twice = LureFavorSchema.parse({ ...favor, needOffers: 2 });
    const state = favorStart();
    expect(offerFavor(twice, state, 'silk')).toBe('loved');
    expect(isFavorDone(twice, state)).toBe(false);
    expect(favorProgress(twice, state)).toBeCloseTo(0.5);
    expect(offerFavor(twice, state, 'silk')).toBe('loved');
    expect(isFavorDone(twice, state)).toBe(true);
    expect(favorsGiven(state)).toBe(2);
  });

  it('favor 有自己的账本（老的两套账本一个字没动）', () => {
    const state = favorStart();
    expect(state).toEqual({
      mode: 'favor', loved: 0, offered: [], offers: 0, lastLoved: null, done: false,
    });
    expect(lureStart(decoy).mode).toBe('decoy');
    expect(lureStart(trade).mode).toBe('trade');
  });
});

describe('美人计 · 点选与小手：手指粗也能点得到', () => {
  it('三样东西的圆心与边缘都算，离得远就是没点着', () => {
    expect(giftAt(favor, 375, 1010)?.id).toBe('silk');
    expect(giftAt(favor, 170, 1010)?.id).toBe('horse');
    expect(giftAt(favor, 170 + 88, 1010)?.id).toBe('horse');
    expect(giftAt(favor, 375 + 88, 1010)?.id).toBe('silk');
    expect(giftAt(favor, 170, 1010 - 89)).toBeUndefined();
    expect(giftAt(favor, 375, 300)).toBeUndefined();
    expect(giftAt(favor, 375, 1010 - 88 - 30, 44)?.id).toBe('silk');
  });

  it('一次都还没递过：小手指他此刻正在看的那一样 —— 教的就是"看他在看什么"', () => {
    const state = favorStart();
    expect(hintGift(favor, state, 0)?.id).toBe('silk');
    expect(hintGift(favor, state, glanceMs)?.id).toBe('horse'); // 这一瞬他扫到马
    // 他正看着别处就指还没递过的那样 —— 绝不提示"哪一样才对"
    const away = glanceCycleMs(favor) - 10;
    expect(glanceAt(favor, away)).toBeNull();
    expect(hintGift(favor, state, away)?.id).toBe('horse');
  });

  it('试过一次之后：小手直接指他最在意的那一样', () => {
    const state = favorStart();
    offerFavor(favor, state, 'horse');
    expect(nextGiftToOffer(favor, state)?.id).toBe('silk');
    // 这一瞬他的目光在马上，小手却指丝绸 —— 试过之后是"陪着走完最后一步"
    expect(glanceAt(favor, glanceMs)?.id).toBe('horse');
    expect(hintGift(favor, state, glanceMs)?.id).toBe('silk');
    offerFavor(favor, state, 'silk');
    expect(nextGiftToOffer(favor, state)?.id).toBe('sword');
  });
});

describe('美人计 · 无头验证：一局真的走得完（照场景 autoplay 的同一条路）', () => {
  it('autoplay 直接送他最在意的那一样 —— 一次就成，绝不会转不完', () => {
    const state = favorStart();
    let offers = 0;
    while (!isFavorDone(favor, state) && offers < 10) {
      expect(offerFavor(favor, state, wantedGift(favor)?.id ?? '')).toBe('loved');
      offers += 1;
    }
    expect(offers).toBe(1);
    expect(favorsGiven(state)).toBe(1);
    expect(state.done).toBe(true);
  });

  it('这一关没有倒计时：一直不送也不会失败（零惩罚）', () => {
    const state = favorStart();
    const cycle = glanceCycleMs(favor);
    expect(glanceAt(favor, cycle * 100)?.id).toBe('silk'); // 目光一直在走
    expect(giftAt(favor, 375, 1010)?.id).toBe('silk'); // 想送随时能送
    expect(isFavorDone(favor, state)).toBe(false);
    expect(favorsGiven(state)).toBe(0);
  });
});

describe('美人计 · schema：这一关必须有解（内容写错不该等孩子玩到一半才发现）', () => {
  it('wants 对不上任何 kind → 直接报错', () => {
    expect(() =>
      LureFavorSchema.parse({ ...favor, target: { ...favor.target, wants: 'jade' } }),
    ).toThrow();
  });

  it('两样东西 kind 一样 → 直接报错（孩子分不出哪样才是他在意的）', () => {
    expect(() =>
      LureFavorSchema.parse({
        ...favor,
        gifts: [favor.gifts[0]!, { ...favor.gifts[1]!, kind: 'horse' }],
      }),
    ).toThrow();
  });

  it('礼物 id 不能重复', () => {
    expect(() =>
      LureFavorSchema.parse({
        ...favor,
        gifts: [favor.gifts[0]!, { ...favor.gifts[1]!, id: 'horse' }],
      }),
    ).toThrow();
  });

  it('关卡脚本里长什么样（与内容 JSON 共用的口径）', () => {
    expect(favor.gifts.map((gift) => gift.kind)).toEqual(['horse', 'silk', 'sword']);
    expect(favor.target).toMatchObject({ x: 375, y: 520, radius: 96, wants: 'silk' });
    expect(favor.needOffers).toBe(1);
    expect(favor.hint.length).toBeLessThanOrEqual(24);
    expect(favor.refuseLine.length).toBeLessThanOrEqual(48);
    for (const gift of favor.gifts) expect(gift.speak.length).toBeLessThanOrEqual(48);
  });
});
