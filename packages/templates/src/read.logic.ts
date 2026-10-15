import type { ReadLevel, ReadTell } from './schemas';

/**
 * 识破（read）的纯判定：什么时候露出了破绽、点中的是不是它、看穿几个才算看懂。
 *
 * **不 import Phaser** —— 判定比画面重要得多，这些函数单测直接调。
 *
 * 三条刻意的设计：
 * - **破绽按时刻出现、只在窗口里看得见**：t 是从这一局开始算起的毫秒数，
 *   窗口是左闭右开 [atMs, atMs + windowMs)。窗口一过，那一处就什么也没有了。
 * - **同一处破绽只算一次**：看穿之后再点它不会重复计数（这里不是刷分的地方）。
 * - **点空零惩罚**：没有破绽的时候点，只记一次 miss —— 不扣星、不结束、不锁操作。
 *   孩子可以放心地乱点，直到他自己学会"等它露出来"。
 */

/** 识破模板的时间常量（场景、单测、e2e 共用同一份） */
export const READ_TIMING = {
  /** 无头验证：把破绽出现的时刻压成几分之一 */
  autoplayFactor: 4,
  /** 无头验证：两处之间至少留这么久，否则挤在一起谁也点不到 */
  autoplayMinGapMs: 280,
  /** 无头验证：窗口至少留这么久 */
  autoplayMinWindowMs: 400,
  /** 无头验证：隔多久看一眼"此刻有没有破绽" */
  autoplayLookMs: 60,
  /** 破绽刚露出来时的亮相时长（画面按它做一次呼吸） */
  appearMs: 180,
  /** 多久没动静就把小手放到下一处 */
  idleMs: 9000,
  /** 看懂之后再看一眼他，才进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚 */
export interface ReadState {
  /** 已经看穿的那几处（按看穿的先后，重复的不记） */
  read: string[];
  /** 空点了几次 —— 只是复盘用，不扣星也不结束 */
  misses: number;
}

export function readStart(): ReadState {
  return { read: [], misses: 0 };
}

/** 破绽在时间轴上的位置（左闭右开，窗口一过就没了） */
export interface TellSlot {
  tell: ReadTell;
  /** 在关卡脚本里的顺序（atMs 递增，schema 已经保证） */
  index: number;
  /** 露出来的时刻 */
  startMs: number;
  /** 收回去的时刻（这一刻起就看不见了） */
  endMs: number;
}

/**
 * 整条时间轴：每一处破绽的起止时刻。
 * 关卡脚本里 atMs 已经递增，这里仍然按它排一遍 —— 顺序就是"该看哪儿"的顺序。
 */
export function tellSlots(level: ReadLevel): TellSlot[] {
  return level.tells
    .map((tell, index) => ({ tell, index, startMs: tell.atMs, endMs: tell.atMs + tell.windowMs }))
    .sort((a, b) => a.startMs - b.startMs || a.index - b.index);
}

/** 这一刻看得见的那一处破绽；没有就是 undefined */
export function tellAt(level: ReadLevel, t: number): ReadTell | undefined {
  return tellAtSlot(level, t)?.tell;
}

/** 同上，但要拿到它在时间轴上的位置（画面画"还剩多久"用） */
export function tellAtSlot(level: ReadLevel, t: number): TellSlot | undefined {
  const ms = Math.max(0, t);
  return tellSlots(level).find((slot) => ms >= slot.startMs && ms < slot.endMs);
}

/** 到这一刻为止露过面的破绽有几处 —— "他还会有下文"的进度感 */
export function tellsSoFar(level: ReadLevel, t: number): number {
  const ms = Math.max(0, t);
  return tellSlots(level).filter((slot) => ms >= slot.startMs).length;
}

/** 下一处破绽什么时候露出来；都露完了就是 undefined */
export function nextTellAt(level: ReadLevel, t: number): ReadTell | undefined {
  const ms = Math.max(0, t);
  return tellSlots(level).find((slot) => slot.startMs > ms)?.tell;
}

/** 窗口还剩多久（没露着的时候是 0）—— 画面按它收光圈 */
export function tellLeftMs(level: ReadLevel, t: number): number {
  const slot = tellAtSlot(level, t);
  return slot === undefined ? 0 : Math.max(0, slot.endMs - Math.max(0, t));
}

/** 这一处看穿了没有 */
export function isTellRead(state: ReadState, tellId: string): boolean {
  return state.read.includes(tellId);
}

/**
 * 看穿了这一处：同一个破绽点两次只算一次。
 * 已经看穿过的原样返回 —— 场景据此跳过重复的表演。
 */
export function applyRead(level: ReadLevel, state: ReadState, tellId: string): ReadState {
  const tell = level.tells.find((item) => item.id === tellId);
  if (tell === undefined || state.read.includes(tell.id)) return state;
  return { read: [...state.read, tell.id], misses: state.misses };
}

/**
 * 点了个空 —— 只是没收获。
 * 这是**唯一**记录"点错了"的地方，而且它什么也不影响：不扣星、不结束、不锁操作。
 */
export function applyMiss(state: ReadState): ReadState {
  return { read: [...state.read], misses: state.misses + 1 };
}

export function readMisses(state: ReadState): number {
  return state.misses;
}

/** 看穿了几处 */
export function readGoal(level: ReadLevel): number {
  return level.goal;
}

/** 看穿 goal 处破绽 = 看懂了他真正的打算 */
export function isReadDone(level: ReadLevel, state: ReadState): boolean {
  return state.read.length >= level.goal;
}

/** 0..1：画面上的进度按它画（"看懂了几分"） */
export function readProgress(level: ReadLevel, state: ReadState): number {
  if (level.goal <= 0) return 1;
  return Math.max(0, Math.min(1, state.read.length / level.goal));
}

/**
 * 还没看穿、而且在 index 之后的第一处 —— 无头验证与提示都按它走。
 * 注意它**不管时刻**：该看哪儿是这一个，什么时候能点由 tellAt 说了算。
 */
export function nextTellToRead(
  level: ReadLevel,
  state: ReadState,
  index = 0,
): ReadTell | undefined {
  return tellSlots(level)
    .filter((slot) => slot.index >= index && !state.read.includes(slot.tell.id))
    .map((slot) => slot.tell)[0];
}

/**
 * 手指落在哪一处破绽上（按屏幕位置算距离，不依赖命中区域）。
 * 给 now（墙钟）时只看**此刻看得见**的那一处 —— 窗口外面点在那里不算看穿。
 * 找不到就是"点了个空"，那是零惩罚的，不是错误。
 */
export function tellNear(
  level: ReadLevel,
  x: number,
  y: number,
  forgive = 0,
  now?: number,
): ReadTell | undefined {
  const visible = now === undefined ? undefined : tellAt(level, now);
  let best: ReadTell | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const tell of level.tells) {
    if (now !== undefined && tell !== visible) continue;
    const dist = Math.hypot(x - tell.x, y - tell.y);
    if (dist <= tell.radius + forgive && dist < bestDist) {
      best = tell;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 无头验证用的关卡：破绽出现的时刻与窗口一起压短。
 * atMs 仍然**严格递增**（schema 要求），而且每一处至少隔 autoplayMinGapMs ——
 * 否则压短之后两处会挤在一起，谁也点不到。
 */
export function autoplayLevel(
  level: ReadLevel,
  autoplay: boolean,
  factor = READ_TIMING.autoplayFactor,
): ReadLevel {
  if (!autoplay || factor <= 1) return level;
  const tells: ReadTell[] = [];
  let previous = -READ_TIMING.autoplayMinGapMs;
  for (const tell of level.tells) {
    const atMs = Math.max(Math.round(tell.atMs / factor), previous + READ_TIMING.autoplayMinGapMs);
    previous = atMs;
    tells.push({
      ...tell,
      atMs,
      windowMs: Math.max(READ_TIMING.autoplayMinWindowMs, Math.round(tell.windowMs / factor)),
    });
  }
  return { ...level, tells };
}
