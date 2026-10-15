import { siegeGain } from './schemas';
import type {
  SiegeCloseLevel, SiegeLevel, SiegeLog, SiegeSupportLevel, SiegeVital,
} from './schemas';

/**
 * 一扇门。
 * schemas.ts 只导出了 `SiegeCloseLevel`（它已经把门的形状框住了），
 * 这里按关卡脚本推出来 —— 免得为了一个类型名去动那份定稿的文件。
 */
export type SiegeExit = SiegeCloseLevel['exits'][number];

/**
 * 正面推了多少、推了几下、哪些要害已经点到。
 * 状态是纯数据：单测直接造一个就能跑，不需要浏览器。
 */
export interface SiegeState {
  /** 正面推进的总量，到 goal 就解围 */
  progress: number;
  /** 点过的要害 id —— 每个要害只能点一次 */
  relieved: string[];
  /** 正面推了几次（"光靠蛮力要推一百下"这件事是看得见的） */
  taps: number;
}

/** 浮点容差：0.2 加一百次不会正好是漂亮的 20 */
const EPS = 1e-9;

export function siegeStart(): SiegeState {
  return { progress: 0, relieved: [], taps: 0 };
}

/** 现在的阻力：初始阻力减去所有"已回防"的要害，最低到 0 */
export function resistanceOf(level: SiegeLevel, state: SiegeState): number {
  const relieved = new Set(state.relieved);
  const relief = level.vital
    .filter((vital) => relieved.has(vital.id))
    .reduce((sum, vital) => sum + vital.relief, 0);
  return Math.max(0, level.resistance - relief);
}

/** 正面推一下能推多远：阻力越大推得越少（siegeGain 的封装） */
export function frontGain(level: SiegeLevel, state: SiegeState): number {
  return siegeGain(resistanceOf(level, state));
}

/** 推一下正面 —— 纯函数，返回新状态；进度封顶在 goal */
export function frontTap(level: SiegeLevel, state: SiegeState): SiegeState {
  const gain = frontGain(level, state);
  return {
    progress: Math.min(level.goal, state.progress + gain),
    relieved: [...state.relieved],
    taps: state.taps + 1,
  };
}

/**
 * 点一处要害：只有第一次生效。
 * 同一个要害点两次不会重复减阻力 —— 不然"点过的要害"就能刷出无限的收益。
 */
export function relieve(level: SiegeLevel, state: SiegeState, vitalId: string): SiegeState {
  const vital = level.vital.find((item) => item.id === vitalId);
  if (!vital || state.relieved.includes(vital.id)) return state;
  return {
    progress: state.progress,
    relieved: [...state.relieved, vital.id],
    taps: state.taps,
  };
}

export function isRelieved(state: SiegeState, vitalId: string): boolean {
  return state.relieved.includes(vitalId);
}

/** 还差几下正面才解围 —— 提示、验算与单测都看它 */
export function tapsToFinish(level: SiegeLevel, state: SiegeState): number {
  const gain = frontGain(level, state);
  if (gain <= 0) return Number.POSITIVE_INFINITY;
  const left = level.goal - state.progress;
  if (left <= EPS) return 0;
  return Math.ceil(left / gain - EPS);
}

/** 0..1：画面上的进度条按它画 */
export function siegeProgress(level: SiegeLevel, state: SiegeState): number {
  if (level.goal <= 0) return 1;
  return Math.max(0, Math.min(1, state.progress / level.goal));
}

/** 推进到 goal 就算解围 */
export function isSiegeDone(level: SiegeLevel, progress: number): boolean {
  return progress + EPS >= level.goal;
}

/** 手指落在哪一处要害上；forgive 让小朋友不用对准 */
export function vitalAt(
  x: number,
  y: number,
  level: SiegeLevel,
  forgive = 0,
): SiegeVital | null {
  let best: SiegeVital | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const vital of level.vital) {
    const dist = Math.hypot(x - vital.x, y - vital.y);
    if (dist <= vital.radius + forgive && dist < bestDist) {
      best = vital;
      bestDist = dist;
    }
  }
  return best;
}

/** 还没点过的要害（按关卡里的顺序）—— 提示与无头验证都用它 */
export function untouchedVitals(level: SiegeLevel, state: SiegeState): SiegeVital[] {
  return level.vital.filter((vital) => !state.relieved.includes(vital.id));
}

export function nextVital(level: SiegeLevel, state: SiegeState): SiegeVital | undefined {
  return untouchedVitals(level, state)[0];
}

/* ---------------- support：釜底抽薪（不跟火硬碰，从底下把柴抽走） ---------------- */

/**
 * 釜底抽薪（support）的账本：抽掉了哪几根柴。
 *
 * 三条刻意的设计：
 * - **火势是算出来的**：抽一根降它自己的 relief；`base` 那根是整堆柴压在底下的那一根，
 *   抽掉它火势骤降（关卡数据里它的 relief 最大 —— 见 `baseLog`）。
 * - **每根只能抽一次**：同一根柴抽两下不会重复降火势 —— 这本账算得清。
 * - **零惩罚**：点空、点已经抽掉的柴，都不扣星、不结束、不锁操作，
 *   火势也不会因为点空又旺回去。
 *
 * **不 import Phaser**：判定比画面重要得多。
 */
export interface SupportState {
  /** 每根柴抽了没有（键是柴的 id）：开局一根都没抽 */
  pulled: Record<string, boolean>;
  /** 已经抽掉的柴，按抽走的先后 —— 画面按它把柴一根根挪开 */
  order: string[];
}

/** 开局：一根柴都没抽（账本按关卡里摆着的柴建） */
export function supportStart(level: SiegeSupportLevel): SupportState {
  return {
    pulled: Object.fromEntries(level.logs.map((log) => [log.id, false])),
    order: [],
  };
}

/** 这是哪一根柴（脚本里写了不存在的 id 就给 undefined，不抛） */
export function logById(level: SiegeSupportLevel, logId: string): SiegeLog | undefined {
  return level.logs.find((log) => log.id === logId);
}

/** 这根抽了没有 */
export function isPulled(state: SupportState, logId: string): boolean {
  return state.pulled[logId] === true;
}

/**
 * 抽一根柴：每根只能抽一次。
 * 不认识的柴、已经抽掉的柴，都原样返回 —— 场景据此跳过重复的表演。
 */
export function pullLog(
  level: SiegeSupportLevel,
  state: SupportState,
  logId: string,
): SupportState {
  const log = logById(level, logId);
  if (log === undefined || isPulled(state, logId)) return state;
  return {
    pulled: { ...state.pulled, [log.id]: true },
    order: [...state.order, log.id],
  };
}

/** 抽掉几根了 */
export function pulledCount(state: SupportState): number {
  return state.order.length;
}

/** 还架在火底下的柴有几根 */
export function standingCount(level: SiegeSupportLevel, state: SupportState): number {
  return level.logs.length - pulledCount(state);
}

/** 火势还剩多少：开局火势减掉抽走的柴各自的 relief，最低到 0（灭） */
export function fireLevel(level: SiegeSupportLevel, state: SupportState): number {
  const relief = level.logs
    .filter((log) => isPulled(state, log.id))
    .reduce((sum, log) => sum + log.relief, 0);
  return Math.max(0, level.fire.level - relief);
}

/** 0..1：灭火的进度（火势到 0 就是 1）—— 画面上的进度条按它画 */
export function supportProgress(level: SiegeSupportLevel, state: SupportState): number {
  if (level.fire.level <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - fireLevel(level, state) / level.fire.level));
}

/** 火势到 0 = 火灭了 = 这一关成了 */
export function isSupportDone(level: SiegeSupportLevel, state: SupportState): boolean {
  return fireLevel(level, state) <= 0;
}

/** 手指落在哪一根柴上（拿最近的那一根）；forgive 让手指粗一点也点得到 */
export function logAt(
  level: SiegeSupportLevel,
  x: number,
  y: number,
  forgive = 0,
): SiegeLog | undefined {
  let best: SiegeLog | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const log of level.logs) {
    const dist = Math.hypot(x - log.x, y - log.y);
    if (dist <= log.radius + forgive && dist < bestDist) {
      best = log;
      bestDist = dist;
    }
  }
  return best;
}

/** 还没抽的下一根柴（小手与无头验证都用它）：按关卡脚本里摆的顺序 */
export function nextLogToPull(
  level: SiegeSupportLevel,
  state: SupportState,
): SiegeLog | undefined {
  return level.logs.find((log) => !isPulled(state, log.id));
}

/**
 * 根上的那根柴（`base: true`）—— "抽掉它火势骤降"的那一根。
 * schema 保证至少有一根；这里只负责找出来。
 */
export function baseLog(level: SiegeSupportLevel): SiegeLog | undefined {
  return level.logs.find((log) => log.base);
}

/* ---------------- close：关门捉贼（抢在贼跑掉之前把出口都关上） ---------------- */

/**
 * 关门捉贼（close）的账本：哪几扇门排上了队、贼跑掉过几回。
 *
 * 三条刻意的设计：
 * - **一扇一扇地关**：门排上队，关好一扇下一扇才开始转 —— 所以 ΣcloseMs 才是
 *   "把所有门关一遍要多久"（关卡的 schema 也照它验算）。孩子点得快没关系：
 *   每一下都排进队里算数；点慢了才会来不及。
 * - **贼在 `escapeAfterMs` 之后跑**：到那一刻还没关完，他就从最近的、还没关上的门
 *   跑掉 —— 这一轮重来（**零惩罚**），只记一笔"跑掉过一回"用来复盘。
 * - **账全按时间算**：这一刻关好了几扇、正在转的是哪一扇、贼还有多久跑，
 *   都是 (状态, 墙钟) 的函数 —— 不必每帧改状态，单测直接喂数字。
 *
 * **不 import Phaser**：判定比画面重要得多。
 */
export interface CloseState {
  /** 这一轮从哪一刻开始算（墙钟，毫秒） */
  startedAtMs: number;
  /** 贼跑掉的绝对时刻 —— 关卡说"多久之后跑"，开局一次算清 */
  escapeAtMs: number;
  /** 排上队的门，按点下去的先后：关好一扇，下一扇才开始转 */
  queue: string[];
  /** 贼跑掉过几回 —— 只是复盘用，重来是零惩罚的 */
  escapes: number;
}

/**
 * 起一轮：门都还开着，贼的倒计时钟开始走。
 * 贼跑掉之后**重来就是再调一次它**（escapes 记一笔，其余全部归零）——
 * 重来不扣星、不结束，只是回到开局。
 */
export function closeStart(
  level: SiegeCloseLevel,
  t: number,
  escapes = 0,
): CloseState {
  const startedAtMs = Math.max(0, t);
  return {
    startedAtMs,
    escapeAtMs: startedAtMs + level.escapeAfterMs,
    queue: [],
    escapes: Math.max(0, Math.floor(escapes)),
  };
}

/** 这是哪一扇门（脚本里写了不存在的 id 就给 undefined，不抛） */
export function exitById(level: SiegeCloseLevel, exitId: string): SiegeExit | undefined {
  return level.exits.find((exit) => exit.id === exitId);
}

/** 这一轮走到这一刻用了多久 */
export function roundElapsedMs(state: CloseState, t: number): number {
  return Math.max(0, Math.max(0, t) - state.startedAtMs);
}

/** 贼还有多久跑（画面上那条倒计时的钟按它画） */
export function escapeLeftMs(state: CloseState, t: number): number {
  return Math.max(0, state.escapeAtMs - Math.max(0, t));
}

/**
 * 排上队的门，各自"关好的时刻"（按关好的先后）。
 * 一扇一扇地关：第 i 扇关好的时刻 = 开局 + 前 i 扇 closeMs 之和。
 */
export function closeSchedule(
  level: SiegeCloseLevel,
  state: CloseState,
): { exit: SiegeExit; doneAtMs: number }[] {
  const out: { exit: SiegeExit; doneAtMs: number }[] = [];
  let acc = state.startedAtMs;
  for (const id of state.queue) {
    const exit = exitById(level, id);
    if (exit === undefined) continue;
    acc += exit.closeMs;
    out.push({ exit, doneAtMs: acc });
  }
  return out;
}

/** 到这一刻为止已经关好的门（按关好的先后） */
export function closedExits(level: SiegeCloseLevel, state: CloseState, t: number): SiegeExit[] {
  const now = Math.max(0, t);
  return closeSchedule(level, state)
    .filter((item) => now >= item.doneAtMs)
    .map((item) => item.exit);
}

/** 关好了几扇 */
export function closedCount(level: SiegeCloseLevel, state: CloseState, t: number): number {
  return closedExits(level, state, t).length;
}

/** 这扇门关好了没有（排了队、而且轮到它转完了） */
export function isExitClosed(
  level: SiegeCloseLevel,
  state: CloseState,
  exitId: string,
  t: number,
): boolean {
  return closedExits(level, state, t).some((exit) => exit.id === exitId);
}

/** 这一刻正关着的那一扇（门在转）；都关好了 / 还没排上队就是 undefined */
export function closingExit(
  level: SiegeCloseLevel,
  state: CloseState,
  t: number,
): SiegeExit | undefined {
  const now = Math.max(0, t);
  return closeSchedule(level, state).find((item) => now < item.doneAtMs)?.exit;
}

/** 正在关的那一扇关到几分了（0..1）—— 画面按它把门转过去 */
export function closingRatio(level: SiegeCloseLevel, state: CloseState, t: number): number {
  const now = Math.max(0, t);
  const item = closeSchedule(level, state).find((entry) => now < entry.doneAtMs);
  if (item === undefined) return 0;
  if (item.exit.closeMs <= 0) return 1;
  const startedAt = item.doneAtMs - item.exit.closeMs;
  return Math.min(1, Math.max(0, (now - startedAt) / item.exit.closeMs));
}

/** 全都关上了 = 贼被关在里头 = 这一关成了 */
export function isCloseDone(level: SiegeCloseLevel, state: CloseState, t: number): boolean {
  return closedCount(level, state, t) >= level.exits.length;
}

/** 0..1：关上几成了 —— 画面上的进度条按它画 */
export function closeProgress(level: SiegeCloseLevel, state: CloseState, t: number): number {
  if (level.exits.length === 0) return 1;
  return closedCount(level, state, t) / level.exits.length;
}

/**
 * 贼跑了没有：到 `escapeAfterMs` 还没把门关完 = 他从门口跑掉了。
 * 跑掉**只是重来**（调用 closeStart 再起一轮），不是失败、不扣星。
 * 已经关完了就不算跑 —— 哪怕时钟已经过了那个点。
 */
export function hasEscaped(level: SiegeCloseLevel, state: CloseState, t: number): boolean {
  if (Math.max(0, t) < state.escapeAtMs) return false;
  return !isCloseDone(level, state, t);
}

/**
 * 关一扇门：把它排进队里。
 * 已经排过队 / 已经关好的门再点不动；贼已经跑了（这一轮结束）也点不动 ——
 * 那要等重来。每一下都算数，所以孩子点得快也不会白点。
 */
export function closeExit(
  level: SiegeCloseLevel,
  state: CloseState,
  exitId: string,
  t: number,
): CloseState {
  const exit = exitById(level, exitId);
  if (exit === undefined || state.queue.includes(exit.id)) return state;
  if (Math.max(0, t) >= state.escapeAtMs) return state;
  return { ...state, queue: [...state.queue, exit.id] };
}

/** 手指落在哪一扇门上（拿最近的那一扇）；forgive 让手指粗一点也点得到 */
export function exitAt(
  level: SiegeCloseLevel,
  x: number,
  y: number,
  forgive = 0,
): SiegeExit | undefined {
  return nearestExit(
    level.exits.filter((exit) => Math.hypot(x - exit.x, y - exit.y) <= exit.radius + forgive),
    level,
  );
}

/** 离贼最近的那一扇门（并列时取关卡脚本里靠前的） */
function nearestExit(exits: SiegeExit[], level: SiegeCloseLevel): SiegeExit | undefined {
  let best: SiegeExit | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const exit of exits) {
    const dist = Math.hypot(exit.x - level.thief.x, exit.y - level.thief.y);
    if (dist < bestDist) {
      best = exit;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 小手该指哪一扇：**还没关的里面离贼最近的那一扇**。
 * 先关他最近的，他才不会一抬脚就溜出去 —— 顺序不影响成败，但这个顺序有道理。
 */
export function nextExitToClose(
  level: SiegeCloseLevel,
  state: CloseState,
): SiegeExit | undefined {
  return nearestExit(
    level.exits.filter((exit) => !state.queue.includes(exit.id)),
    level,
  );
}

/**
 * 贼会从哪扇门跑：**最近的、还没关上的那一扇**。
 * 正在转、还没关严的门也算"没关上" —— 他照样钻得出去。
 */
export function escapeExit(
  level: SiegeCloseLevel,
  state: CloseState,
  t: number,
): SiegeExit | undefined {
  const closed = new Set(closedExits(level, state, t).map((exit) => exit.id));
  return nearestExit(
    level.exits.filter((exit) => !closed.has(exit.id)),
    level,
  );
}
