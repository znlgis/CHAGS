import type { ShowLevel, ShowSlot } from './schemas';

/**
 * 造势（show）的纯判定：从什么都没有开始，把一个**不存在的东西**维持住。
 *
 * 这一关的账本只有一条 —— **同时立着的影子够 needed 个，对面的疑心才涨**。
 * 一笔画下去只管 fadeMs：到点就淡掉，得回头补。所以这不是"点一下"的游戏，
 * 是"撑着"的游戏：手一停，势就落。
 *
 * 判定全部按**时间轴**算（t 是从这一局开始算起的毫秒数）：
 * 场景用墙钟喂 t 与每帧的 delta，单测直接喂数字 —— 同一份判定，两边不会跑偏。
 * **不 import Phaser**：判定的边界比画面重要得多。
 */

/**
 * 疑心的涨落速度。
 * 它不写进 schema：关卡数据管的是"几个空位、一笔立多久、要几个影子、涨到多少"，
 * 涨多快、落多慢是这一关的手感 —— 但单测、画面与无头验证共用这一份。
 */
export const SHOW_RATES = {
  /** 影子够 needed 的时候，疑心每秒涨多少 */
  risePerSec: 14,
  /** 不够的时候，疑心每秒落多少（比涨慢：造起来的势不该一下子塌掉） */
  fallPerSec: 6,
  /** 无头验证：把每帧的记账时间放大这么多倍，一局几秒走完（影子该淡还是照淡） */
  autoplayFactor: 3,
} as const;

/** 浮点容差：14 加一百次不会正好是漂亮的 100 */
const EPS = 1e-9;

/** 一局里攒下来的东西：每一笔画在什么时候、疑心涨到哪儿了 */
export interface ShowState {
  /** 每个空位上那一笔是什么时候画的；没画过就没有这一项 */
  paintedAt: Record<string, number>;
  /** 疑心涨到多少了（由 tick 一笔一笔记账） */
  belief: number;
  /** 疑心记账到哪一刻了 */
  updatedAtMs: number;
  /** 一共画了多少笔（复盘用，不惩罚） */
  strokes: number;
}

export function showStart(): ShowState {
  return { paintedAt: {}, belief: 0, updatedAtMs: 0, strokes: 0 };
}

/** 疑心夹回 0..goal —— 涨满就是涨满，落空就是落空 */
function clampBelief(level: ShowLevel, value: number): number {
  return Math.min(level.goal, Math.max(0, value));
}

/** 这个空位上的一笔是什么时候画的；没画过 = null */
export function paintedAtMs(state: ShowState, slotId: string): number | null {
  return state.paintedAt[slotId] ?? null;
}

/** 这一笔还立着吗：画过，而且离淡掉还有时间（t 早于落笔时也算没立着） */
export function isShadowAlive(level: ShowLevel, state: ShowState, slotId: string, t: number): boolean {
  const at = paintedAtMs(state, slotId);
  if (at === null) return false;
  const age = Math.max(0, t) - at;
  return age >= 0 && age < level.fadeMs;
}

/** 还在立着的影子是哪几个（按关卡里空位的顺序） */
export function aliveShadowIds(level: ShowLevel, state: ShowState, t: number): string[] {
  return level.slots.filter((slot) => isShadowAlive(level, state, slot.id, t)).map((s) => s.id);
}

/** 还在立着的影子有几个 —— 这一关的核心计数 */
export function aliveShadows(level: ShowLevel, state: ShowState, t: number): number {
  return aliveShadowIds(level, state, t).length;
}

/** 这一笔还立得住多久（没立着 = 0）—— 画面上影子随它淡下去 */
export function shadowLeftMs(level: ShowLevel, state: ShowState, slotId: string, t: number): number {
  const at = paintedAtMs(state, slotId);
  if (at === null) return 0;
  const age = Math.max(0, t) - at;
  if (age < 0) return 0; // 这一刻这一笔还没落下去（单测里回看时会出现）
  return Math.max(0, level.fadeMs - age);
}

/** 影子还剩几分（1 = 刚画上，0 = 淡没了）—— 画面按它给透明度与大小 */
export function shadowStrength(level: ShowLevel, state: ShowState, slotId: string, t: number): number {
  if (level.fadeMs <= 0) return 0;
  return Math.min(1, Math.max(0, shadowLeftMs(level, state, slotId, t) / level.fadeMs));
}

/**
 * 画一笔：把这个空位上的影子**重新立起来**。
 * 注意它不是"往库里再加一个影子"，而是把这一笔的时辰改到此刻 ——
 * 空位永远是那几个，孩子做的是"续上"，不是"攒数量"。
 */
export function paint(state: ShowState, slotId: string, t: number): ShowState {
  return {
    ...state,
    paintedAt: { ...state.paintedAt, [slotId]: Math.max(0, t) },
    strokes: state.strokes + 1,
  };
}

/** 此刻疑心是涨还是落：影子够 needed 就涨，不够就缓慢回落 */
export function beliefRate(level: ShowLevel, state: ShowState, t: number): number {
  return aliveShadows(level, state, t) >= level.needed
    ? SHOW_RATES.risePerSec
    : -SHOW_RATES.fallPerSec;
}

/**
 * 记一帧的账：按这一刻立着的影子数，把疑心往前推 deltaMs。
 * 画面每帧调它一次（无头验证把 delta 放大几倍，一局很快就走完）。
 */
export function tick(level: ShowLevel, state: ShowState, t: number, deltaMs: number): ShowState {
  const step = (beliefRate(level, state, t) * Math.max(0, deltaMs)) / 1000;
  return {
    ...state,
    belief: clampBelief(level, state.belief + step),
    updatedAtMs: Math.max(state.updatedAtMs, Math.max(0, t)),
  };
}

/**
 * 疑心此刻是多少。
 * 画面每帧都会 tick，所以这里给的就是最新的数；t 只是把"最后一次记账到现在"
 * 的那一点点也算进来 —— 于是单测里 beliefAt(t) 与 tick(t, t - updatedAtMs) 对得上。
 */
export function beliefAt(level: ShowLevel, state: ShowState, t: number): number {
  const sinceMs = Math.max(0, t) - state.updatedAtMs;
  if (sinceMs <= 0) return clampBelief(level, state.belief);
  return clampBelief(level, state.belief + (beliefRate(level, state, t) * sinceMs) / 1000);
}

/** 疑心涨到 goal 就算成 —— 这一计的本体是**维持**，不是点一下 */
export function isShowDone(level: ShowLevel, state: ShowState): boolean {
  return state.belief + EPS >= level.goal;
}

/** 还差几个影子才够 needed（够 = 0）—— 提示与画面都用它 */
export function missingShadows(level: ShowLevel, state: ShowState, t: number): number {
  return Math.max(0, level.needed - aliveShadows(level, state, t));
}

/**
 * 接下来该补哪一笔（小手、提示与无头验证都用它）：
 * - 影子不够，就先去立一个还空着的位子；
 * - 够了，就去续**最快要淡掉**的那一笔。
 *
 * 这两条合起来，就是"轮转补画"：同时立着的影子一直不掉到 needed 以下。
 */
export function nextSlotToPaint(level: ShowLevel, state: ShowState, t: number): ShowSlot | undefined {
  if (aliveShadows(level, state, t) < level.needed) {
    const empty = level.slots.find((slot) => !isShadowAlive(level, state, slot.id, t));
    if (empty) return empty;
  }
  let soonest: ShowSlot | undefined;
  let leastLeft = Number.POSITIVE_INFINITY;
  for (const slot of level.slots) {
    const left = shadowLeftMs(level, state, slot.id, t);
    if (left <= 0) continue;
    if (left < leastLeft) {
      soonest = slot;
      leastLeft = left;
    }
  }
  return soonest ?? level.slots[0];
}

/** 手指落在哪个空位上（拿最近的那个）；forgive 让小朋友不用对准 */
export function slotAt(level: ShowLevel, x: number, y: number, forgive = 0): ShowSlot | undefined {
  let best: ShowSlot | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const slot of level.slots) {
    const dist = Math.hypot(x - slot.x, y - slot.y);
    if (dist <= slot.radius + forgive && dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return best;
}
