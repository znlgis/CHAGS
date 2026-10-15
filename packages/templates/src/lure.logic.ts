import type { LureBait, LureLevel, LureOffer, LureReturn } from './schemas';

/**
 * 诱饵（lure）的纯判定：两种模式共用一句话 —— **把他引开，或者先给一点点**。
 *
 * - **decoy（调虎离山）**：看守站在岗位上，把诱饵放到某个诱饵点，他会走过去看，
 *   岗位空出一段时间。拿东西要的是**连续**的空档：看守一回来，没拿完的就清零重来
 *   （零惩罚）。所以难的不是手快，是**挑一个能空够久的诱饵点**。
 * - **trade（抛砖引玉）**：先递出一块"砖"，对方拿出更好的来换。挑错了只是再挑一次
 *   （零惩罚）—— 难的是看出**哪块砖**才引来玉。
 *
 * 判定全部按**时间轴**算（t 是从这一局开始算起的毫秒数）：
 * 场景用墙钟喂 t，单测直接喂数字 —— 同一份判定，两边不会跑偏。
 * **不 import Phaser**：判定的边界比画面重要得多。
 */

export type LureDecoyLevel = Extract<LureLevel, { mode: 'decoy' }>;
export type LureTradeLevel = Extract<LureLevel, { mode: 'trade' }>;

/**
 * 诱饵模板的时间常量（场景、单测、无头验证共用同一份）。
 * 空档多长、要连续拿多久写在关卡数据里（那是内容）；这里放的是手感与无头验证的压缩比。
 */
export const LURE_TIMING = {
  /** 无头验证：把空档与"要连续拿多久"按同一个比例压短 */
  autoplayFactor: 4,
  /** 无头验证：空档压短之后至少留这么久，否则一帧就过去了 */
  autoplayMinAwayMs: 900,
  /** 无头验证：要连续拿走的时长至少留这么久 */
  autoplayMinNeedMs: 600,
  /** 无头验证：隔多久递出一块砖（trade 模式一次就成，只是别在第一帧就赢） */
  autoplayGiveMs: 480,
  /** 多久没动静就把提示与小手放出来 */
  idleMs: 9000,
  /** 看守回岗、没拿完的散掉：画面上演多久 */
  resetFlashMs: 900,
  /** 换回东西之后对方那一下：演多久 */
  tradeFlashMs: 1400,
  /** 拿到之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 浮点容差：16 加三百次不会正好是漂亮的 4800 */
const EPS = 1e-9;

// ---------------- decoy：把看守引开，趁空档把东西拿走 ----------------

/** 一局 decoy 里攒下来的东西：看守在不在、拿到了多少、被回岗打断过几次 */
export interface LureDecoyState {
  mode: 'decoy';
  /** 正在用的诱饵点；看守在岗 = null */
  baitId: string | null;
  /** 这一次诱饵是什么时候放下的（空档从这一刻算起） */
  baitAtMs: number;
  /** 空档里**连续**拿走了多久（看守一回岗就清零） */
  grabMs: number;
  /** 孩子的手指此刻按在箱子上吗 —— 松手就断，"连续"靠它守着 */
  holding: boolean;
  /** 上一次记账到哪一刻 —— 没按住的时候它也往前推，免得把"没按"的那段算进去 */
  grabAtMs: number;
  /** 看守回了几次岗（没拿完的回岗：清零，可以再来 —— 零惩罚） */
  returns: number;
  /** 上一次回岗是什么时候（画面演"散掉"用）；还没回过 = 负无穷 */
  lastReturnAtMs: number;
  /** 放过的诱饵点（按先后，复盘用） */
  usedBaits: string[];
  /** 箱子拿到手了 */
  done: boolean;
}

export function decoyStart(): LureDecoyState {
  return {
    mode: 'decoy',
    baitId: null,
    baitAtMs: 0,
    grabMs: 0,
    holding: false,
    grabAtMs: 0,
    returns: 0,
    lastReturnAtMs: Number.NEGATIVE_INFINITY,
    usedBaits: [],
    done: false,
  };
}

/** 这个诱饵点长什么样；没放诱饵、或者 id 不存在 = undefined */
export function baitById(level: LureDecoyLevel, baitId: string | null): LureBait | undefined {
  if (baitId === null) return undefined;
  return level.baits.find((bait) => bait.id === baitId);
}

/**
 * 岗位还空着多久（毫秒）。
 * 看守在岗 = 0；窗口一过也 = 0 —— 空档是左闭右开 [放下, 放下 + awayMs)。
 */
export function awayLeftMs(level: LureDecoyLevel, state: LureDecoyState, t: number): number {
  const bait = baitById(level, state.baitId);
  if (bait === undefined) return 0;
  const elapsed = Math.max(0, t) - state.baitAtMs;
  return Math.max(0, bait.awayMs - Math.max(0, elapsed));
}

/** 看守此刻离岗了吗 */
export function isAway(level: LureDecoyLevel, state: LureDecoyState, t: number): boolean {
  return awayLeftMs(level, state, t) > 0;
}

/** 这一次诱饵能让岗位空多久（正在用的那个；在岗 = 0）—— 画面上那圈倒计时按它算 */
export function awayTotalMs(level: LureDecoyLevel, state: LureDecoyState): number {
  return baitById(level, state.baitId)?.awayMs ?? 0;
}

/**
 * 放下一个诱饵：看守离岗，空档从这一刻开始算。
 *
 * 两个刻意的规矩：
 * - **看守已经在路上了，再放一个不管用**（返回原样）—— 否则连点诱饵点就能把空档无限续下去；
 * - 记账点（grabAtMs）跟着挪到此刻 —— 放下诱饵之前的那段当然不算"连续的空档"。
 */
export function placeBait(
  level: LureDecoyLevel,
  state: LureDecoyState,
  baitId: string,
  t: number,
): LureDecoyState {
  const bait = baitById(level, baitId);
  if (bait === undefined || state.done) return state;
  if (isAway(level, state, t)) return state;
  const now = Math.max(0, t);
  return {
    ...state,
    baitId: bait.id,
    baitAtMs: now,
    grabMs: 0,
    grabAtMs: now,
    usedBaits: [...state.usedBaits, bait.id],
  };
}

/**
 * 按住箱子：这一刻才开始算"连续的空档"，之后每一帧把时间记进 grabMs。
 *
 * 两个刻意的规矩：
 * - **只在空档里**才记账：看守在岗时按它什么也不会发生（零惩罚）—— 白按，不扣星、不结束；
 * - **松手就断**：releaseGrab 之后再一次 grabAt 从那一刻重新算起（场景每帧都调，两次调用之间
 *   不会把"没按"的那段偷偷记进去），这就是"要连续"的那一半意思。
 */
export function grabAt(level: LureDecoyLevel, state: LureDecoyState, t: number): LureDecoyState {
  if (state.done) return state;
  const now = Math.max(0, t);
  if (!state.holding) return { ...state, holding: true, grabAtMs: now };
  const since = Math.max(0, now - state.grabAtMs);
  const credit = Math.min(since, awayLeftMs(level, state, now));
  if (credit <= 0) {
    return state.grabAtMs === now ? state : { ...state, grabAtMs: now };
  }
  const grabMs = Math.min(level.prize.needMs, state.grabMs + credit);
  return { ...state, grabMs, grabAtMs: now, done: grabMs + EPS >= level.prize.needMs };
}

/**
 * 松手（或者手指离开了箱子）：连续被打断。
 * 幂等 —— 场景每帧都能调，没按着的时候调它什么都不改。
 */
export function releaseGrab(state: LureDecoyState, t: number): LureDecoyState {
  if (!state.holding) return state;
  return { ...state, holding: false, grabAtMs: Math.max(0, t) };
}

/**
 * 看守回岗：**没拿完的就清零**（可以再来，零惩罚）。
 * 场景每帧调它一次，所以孩子看到的始终是最新的岗上状态。
 */
export function guardBack(level: LureDecoyLevel, state: LureDecoyState, t: number): LureDecoyState {
  if (state.baitId === null || isAway(level, state, t)) return state;
  const now = Math.max(0, t);
  return {
    ...state,
    baitId: null,
    baitAtMs: 0,
    grabMs: 0,
    holding: false,
    grabAtMs: now,
    returns: state.returns + 1,
    lastReturnAtMs: now,
  };
}

/** 空档里连续拿够了 needMs = 拿走了 —— 这一关的本体是"挑对诱饵点"，不是手快 */
export function isDecoyDone(level: LureDecoyLevel, state: LureDecoyState): boolean {
  return state.grabMs + EPS >= level.prize.needMs;
}

/** 拿到几成（0..1）—— 箱子上那圈进度按它画 */
export function grabProgress(level: LureDecoyLevel, state: LureDecoyState): number {
  if (level.prize.needMs <= 0) return 1;
  return Math.min(1, Math.max(0, state.grabMs / level.prize.needMs));
}

/**
 * 够长的诱饵点里**最短**的那个（刚好够用）—— 无头验证照它选，卡住时的提示也照它指。
 * 一个都不够（内容写错，schema 会先拦下）就退化成最久的那个。
 */
export function bestBait(level: LureDecoyLevel): LureBait | undefined {
  const enough = level.baits.filter((bait) => bait.awayMs + EPS >= level.prize.needMs);
  const pool = enough.length > 0 ? enough : level.baits;
  let best: LureBait | undefined;
  for (const bait of pool) {
    if (best === undefined || bait.awayMs < best.awayMs) best = bait;
  }
  return best;
}

/** 哪几个诱饵点能空够久 —— 内容数据里该有几个就是几个（教学点全在这里） */
export function baitsLongEnough(level: LureDecoyLevel): LureBait[] {
  return level.baits.filter((bait) => bait.awayMs + EPS >= level.prize.needMs);
}

/** 手指落在哪个诱饵点上（拿最近的那个）；forgive 让小朋友不用对准 */
export function baitAt(
  level: LureDecoyLevel,
  x: number,
  y: number,
  forgive = 0,
): LureBait | undefined {
  let best: LureBait | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const bait of level.baits) {
    const dist = Math.hypot(x - bait.x, y - bait.y);
    if (dist <= bait.radius + forgive && dist < bestDist) {
      best = bait;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指落在箱子上吗（按住它才拿得动） */
export function prizeHit(
  level: LureDecoyLevel,
  x: number,
  y: number,
  forgive = 0,
): boolean {
  return Math.hypot(x - level.prize.x, y - level.prize.y) <= level.prize.radius + forgive;
}

// ---------------- trade：先给一块砖，挑对了才换回玉 ----------------

/** 一局 trade 里攒下来的东西：递过哪几块砖、换回的最好的是什么 */
export interface LureTradeState {
  mode: 'trade';
  /** 递出去过的"砖"（按先后；同一块递两次就记两笔 —— 零惩罚） */
  given: string[];
  /** 换回来的最好的一件值多少 */
  best: number;
  /** 刚刚换回来的是什么（画面演对方的反应用它） */
  lastReturn: LureReturn | null;
  /** 递了几次 */
  gives: number;
  /** 换到 value >= needed 的"玉"了 */
  done: boolean;
}

export function tradeStart(): LureTradeState {
  return { mode: 'trade', given: [], best: 0, lastReturn: null, gives: 0, done: false };
}

/** 这块"砖"是什么；id 不存在 = undefined */
export function offerById(level: LureTradeLevel, offerId: string): LureOffer | undefined {
  return level.offers.find((offer) => offer.id === offerId);
}

/** 这块"砖"递过去，对方会还回来什么 —— **每一块都能查到**（schema 已经保证） */
export function offerFor(level: LureTradeLevel, offerId: string): LureReturn | undefined {
  return level.returns.find((item) => item.offerId === offerId);
}

/**
 * 递出去一块"砖"：换回来什么都记下来。
 * 挑错了**只是再挑一次**：不扣星、不结束、不算失败 —— 只多记一笔。
 */
export function give(
  level: LureTradeLevel,
  state: LureTradeState,
  offerId: string,
): LureTradeState {
  const back = offerFor(level, offerId);
  if (back === undefined || offerById(level, offerId) === undefined) return state;
  const best = Math.max(state.best, back.value);
  return {
    mode: 'trade',
    given: [...state.given, offerId],
    best,
    lastReturn: back,
    gives: state.gives + 1,
    done: best + EPS >= level.needed,
  };
}

/** 换到 value >= needed 就算成 —— 之前挑错多少次都不影响 */
export function isTradeDone(level: LureTradeLevel, state: LureTradeState): boolean {
  return state.best + EPS >= level.needed;
}

/** 换到几成（0..1）—— 画面上的进度按它画 */
export function tradeProgress(level: LureTradeLevel, state: LureTradeState): number {
  if (level.needed <= 0) return 1;
  return Math.min(1, Math.max(0, state.best / level.needed));
}

/** 换回最多的是哪一块"砖" —— 无头验证直接递这一块（孩子得自己试出来） */
export function bestOffer(level: LureTradeLevel): LureOffer | undefined {
  let best: LureOffer | undefined;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const offer of level.offers) {
    const value = offerFor(level, offer.id)?.value ?? Number.NEGATIVE_INFINITY;
    if (value > bestValue) {
      best = offer;
      bestValue = value;
    }
  }
  return best;
}

/**
 * 还没递过的那一块 —— 小手与提示都按它指。
 * 注意它**不按 value 排**：哪块砖换回最多，要孩子自己试出来。
 */
export function nextOfferToGive(
  level: LureTradeLevel,
  state: LureTradeState,
): LureOffer | undefined {
  return level.offers.find((offer) => !state.given.includes(offer.id));
}

/** 这块砖已经递过了吗；递过就把换回来的东西摆出来（没递过的不揭晓） */
export function givenReturnFor(
  level: LureTradeLevel,
  state: LureTradeState,
  offerId: string,
): LureReturn | null {
  if (!state.given.includes(offerId)) return null;
  return offerFor(level, offerId) ?? null;
}

/** 手指落在哪一块"砖"上；forgive 让小朋友不用对准 */
export function offerAt(
  level: LureTradeLevel,
  x: number,
  y: number,
  forgive = 0,
): LureOffer | undefined {
  let best: LureOffer | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const offer of level.offers) {
    const dist = Math.hypot(x - offer.x, y - offer.y);
    if (dist <= offer.radius + forgive && dist < bestDist) {
      best = offer;
      bestDist = dist;
    }
  }
  return best;
}

// ---------------- 两种模式共用 ----------------

export type LureState = LureDecoyState | LureTradeState;

/** 开局：按模式给一份空账本（两种模式的账本完全不同，所以是两个函数各管一摊） */
export function lureStart(level: LureLevel): LureState {
  return level.mode === 'decoy' ? decoyStart() : tradeStart();
}

/**
 * 无头验证用的关卡：把空档与"要连续拿多久"按同一个比例压短。
 * 两者一起缩，**"够不够长"的关系不变**（本来够的还够，本来不够的还是不够）——
 * 教学点不会被压缩弄丢；needMs 再夹一次，保证压短之后这一关仍然有解。
 */
export function lureAutoplayLevel(
  level: LureLevel,
  autoplay: boolean,
  factor: number = LURE_TIMING.autoplayFactor,
): LureLevel {
  if (!autoplay || factor <= 1 || level.mode !== 'decoy') return level;
  const scale = (ms: number, floor: number): number => Math.max(floor, Math.round(ms / factor));
  const baits: LureBait[] = level.baits.map((bait) => ({
    ...bait,
    awayMs: scale(bait.awayMs, LURE_TIMING.autoplayMinAwayMs),
  }));
  const longest = Math.max(...baits.map((bait) => bait.awayMs));
  return {
    ...level,
    baits,
    prize: {
      ...level.prize,
      needMs: Math.min(scale(level.prize.needMs, LURE_TIMING.autoplayMinNeedMs), longest),
    },
  };
}
