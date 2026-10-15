import type { WindowJob, WindowLevel } from './schemas';

/**
 * 时机窗口：活儿谁都会干，难的是**等对时候**。
 *
 * 两个模式共用同一张周期表（稳 calmMs → 征兆 → 窗口 windowMs）：
 * - fire（趁火打劫）：活儿都在那儿等着，窗口一开，哪件都能干；
 * - glimpse（顺手牵羊）：队伍沿路走，这一轮**只路过一件机会** —— 只在窗口里抓得住，
 *   点别处什么也不发生；一趟（travelMs）走完还没抓够，就把队伍带回起点重走一遍（零惩罚）。
 *
 * 共同的三条：calm 期点它什么也不发生（靠近就被赶回来）；窗口关上，没干完的进度清零；
 * 干完 `goal` 件就算成功。判定全部按时间轴算，场景只喂墙钟，单测直接喂数字。
 */

export type WindowPhase = 'calm' | 'warn' | 'window';

/**
 * 窗口打开前的征兆时长。
 * 它不写进 schema：关卡数据管的是"稳多久、乱多久"，征兆是手感。
 */
export const WINDOW_WARN_MS = 700;

export interface WindowState {
  /** 每件活儿已经干了多少毫秒的活儿 */
  work: Record<string, number>;
  /** 干完了的活儿（按完成顺序）—— 干完的不会因为窗口关上而清零 */
  done: string[];
  /** 窗口关上时白跑了几个半截 —— 只用于复盘，不惩罚 */
  resets: number;
}

/** 一件活儿要点几下（单测、提示语与关卡验算共用） */
export function tapsNeeded(job: WindowJob, level: WindowLevel): number {
  return Math.max(1, Math.ceil(job.workMs / level.workTapMs));
}

export function windowStart(): WindowState {
  return { work: {}, done: [], resets: 0 };
}

export function cycleMs(level: WindowLevel): number {
  return level.cycle.calmMs + level.cycle.windowMs;
}

/** 第几个周期（0 起）；负数也能落到正确的周期上 */
export function cycleIndexAt(level: WindowLevel, t: number): number {
  const span = cycleMs(level);
  if (span <= 0) return 0;
  return Math.floor(Math.max(0, t) / span);
}

/**
 * glimpse（顺手牵羊）：**这一轮只路过一件机会**。
 *
 * 队伍沿路走，每一轮轮着放出一件路边的机会（`jobs[cycleIndexAt % jobs.length]`）——
 * "抓紧时机"在这里就变成了"抓紧这一轮的那一件"：点别处的什么也不发生。
 * fire 没有"这一轮只有这一件"的语义（活儿都在那儿等着），所以返回 undefined。
 */
export function currentJob(level: WindowLevel, t: number): WindowJob | undefined {
  if (level.mode !== 'glimpse' || level.jobs.length === 0) return undefined;
  return level.jobs[cycleIndexAt(level, t) % level.jobs.length];
}

/** 这一趟还剩多久（glimpse）；fire 没有"一趟"，恒为 0 */
export function travelLeftMs(level: WindowLevel, t: number): number {
  if (level.travelMs === undefined) return 0;
  return Math.max(0, level.travelMs - Math.max(0, t));
}

/** 这一趟走完了（glimpse）；fire 没有"一趟"，永远不算走完 */
export function isTravelOver(level: WindowLevel, t: number): boolean {
  return level.travelMs !== undefined && travelLeftMs(level, t) <= 0;
}

/**
 * 一趟走完还没抓够：把这一趟的账结掉，**重走一遍**（零惩罚）。
 * 抓到的留着（顺手牵到的羊不会跑掉），没干完的清零，只记一笔"白跑一趟"用来复盘。
 */
export function restartTravel(state: WindowState, level: WindowLevel): WindowState {
  return closeWindow(state, level);
}

/** 此刻是稳、是征兆、还是窗口开了 */
export function phaseAt(
  level: WindowLevel,
  t: number,
  warnMs: number = WINDOW_WARN_MS,
): WindowPhase {
  const span = cycleMs(level);
  if (span <= 0) return 'calm';
  const local = Math.max(0, t) % span;
  const { calmMs } = level.cycle;
  if (local >= calmMs) return 'window';
  const warn = Math.min(Math.max(0, warnMs), calmMs);
  return local >= calmMs - warn ? 'warn' : 'calm';
}

/** 现在这一段还剩多久（画面上"窗口快关了"的钟） */
export function phaseRemainingMs(
  level: WindowLevel,
  t: number,
  warnMs: number = WINDOW_WARN_MS,
): number {
  const span = cycleMs(level);
  if (span <= 0) return 0;
  const local = Math.max(0, t) % span;
  const phase = phaseAt(level, t, warnMs);
  if (phase === 'window') return level.cycle.windowMs - (local - level.cycle.calmMs);
  if (phase === 'warn') return level.cycle.calmMs - local;
  return level.cycle.calmMs - Math.min(Math.max(0, warnMs), level.cycle.calmMs) - local;
}

/** 这一段已经过去多少（0..1）—— 画面上火光与脚步的节奏用它 */
export function phaseProgress(
  level: WindowLevel,
  t: number,
  warnMs: number = WINDOW_WARN_MS,
): number {
  const phase = phaseAt(level, t, warnMs);
  const total =
    phase === 'window'
      ? level.cycle.windowMs
      : phase === 'warn'
        ? Math.min(Math.max(0, warnMs), level.cycle.calmMs)
        : level.cycle.calmMs - Math.min(Math.max(0, warnMs), level.cycle.calmMs);
  if (total <= 0) return 1;
  const remaining = phaseRemainingMs(level, t, warnMs);
  return Math.min(1, Math.max(0, 1 - remaining / total));
}

/** 距离下一个窗口打开还有多久（无头验证与提示都用得上） */
export function nextWindowInMs(level: WindowLevel, t: number, warnMs: number = WINDOW_WARN_MS): number {
  const phase = phaseAt(level, t, warnMs);
  if (phase === 'window') return 0;
  const span = cycleMs(level);
  const local = Math.max(0, t) % span;
  return level.cycle.calmMs - local;
}

/** 手指落在哪件活儿上；forgive 让小朋友不用对准 */
export function jobAt(
  x: number,
  y: number,
  level: WindowLevel,
  forgive = 0,
): WindowJob | null {
  let best: WindowJob | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const job of level.jobs) {
    const dist = Math.hypot(x - job.x, y - job.y);
    if (dist <= job.radius + forgive && dist < bestDist) {
      best = job;
      bestDist = dist;
    }
  }
  return best;
}

/** 这个活儿干了多少（干完的按满算） */
export function jobWork(state: WindowState, level: WindowLevel, jobId: string): number {
  const job = level.jobs.find((item) => item.id === jobId);
  if (!job) return 0;
  if (state.done.includes(jobId)) return job.workMs;
  return Math.min(job.workMs, Math.max(0, state.work[jobId] ?? 0));
}

/** 这个活儿的进度 0..1 */
export function jobProgress(state: WindowState, level: WindowLevel, jobId: string): number {
  const job = level.jobs.find((item) => item.id === jobId);
  if (!job || job.workMs <= 0) return 0;
  return jobWork(state, level, jobId) / job.workMs;
}

export function isJobDone(state: WindowState, jobId: string): boolean {
  return state.done.includes(jobId);
}

/** 点一下活儿：推进 workTapMs，够了就算干完 */
export function tapJob(state: WindowState, level: WindowLevel, jobId: string): WindowState {
  const job = level.jobs.find((item) => item.id === jobId);
  if (!job) return state;
  if (state.done.includes(jobId)) return state;
  const work = Math.min(job.workMs, Math.max(0, state.work[jobId] ?? 0) + level.workTapMs);
  const next: WindowState = { ...state, work: { ...state.work, [jobId]: work } };
  if (work >= job.workMs) next.done = [...state.done, jobId];
  return next;
}

/**
 * 在某一刻点了某件活儿。
 * **只有窗口里才推得动** —— 稳的时候点它什么也不发生（这就是"被赶回来"）。
 *
 * glimpse 还多一条：**只接受"这一轮路过的那一件"**。
 * 点到上一轮 / 下一轮的机会，和点在空地上一样 —— 什么也不发生（零惩罚）。
 * 这一趟走完了也一样：那已经不是"错过"，是这一趟结束了（场景会把队伍带回起点重走）。
 */
export function tapAt(
  state: WindowState,
  level: WindowLevel,
  jobId: string,
  t: number,
  warnMs: number = WINDOW_WARN_MS,
): WindowState {
  if (phaseAt(level, t, warnMs) !== 'window') return state;
  if (level.mode === 'glimpse') {
    if (isTravelOver(level, t)) return state;
    if (currentJob(level, t)?.id !== jobId) return state;
  }
  return tapJob(state, level, jobId);
}

/** 窗口关上：没干完的进度清零，干完的留着（零惩罚） */
export function closeWindow(state: WindowState, level: WindowLevel): WindowState {
  const lost = level.jobs.some(
    (job) => !state.done.includes(job.id) && (state.work[job.id] ?? 0) > 0,
  );
  const work: Record<string, number> = {};
  for (const job of level.jobs) {
    work[job.id] = state.done.includes(job.id) ? job.workMs : 0;
  }
  return { ...state, work, resets: state.resets + (lost ? 1 : 0) };
}

/** 干完了几件 */
export function doneCount(state: WindowState): number {
  return state.done.length;
}

/** 干完 goal 件就成功了 */
export function isWindowDone(level: WindowLevel, state: WindowState): boolean {
  return doneCount(state) >= level.goal;
}

/** 下一件还没干完的活儿（提示与无头验证都用它） */
export function nextJob(level: WindowLevel, state: WindowState): WindowJob | undefined {
  return level.jobs.find((job) => !state.done.includes(job.id));
}

/** 无头验证：把"稳 / 乱"的周期压成几分之一，每一段都留得下点几下 */
export const WINDOW_MIN_PHASE_MS = 200;

/**
 * 一趟至少要走这么多个窗口：每件机会都得轮到一次。
 * 压缩过头就会变成"抓不够"——无头验证会一趟一趟地重走，永远走不完。
 */
export function travelFloorMs(level: WindowLevel, cycle: WindowLevel['cycle']): number {
  return (cycle.calmMs + cycle.windowMs) * Math.max(1, level.jobs.length);
}

export function effectiveCycle(
  level: WindowLevel,
  autoplay: boolean,
  factor = 3,
): WindowLevel {
  if (!autoplay || factor <= 1) return level;
  const scale = (ms: number): number => Math.max(WINDOW_MIN_PHASE_MS, Math.round(ms / factor));
  const cycle = { calmMs: scale(level.cycle.calmMs), windowMs: scale(level.cycle.windowMs) };
  if (level.travelMs === undefined) return { ...level, cycle };
  // glimpse：这一趟也要压短，但至少留得下 jobs.length 个窗口
  return { ...level, cycle, travelMs: Math.max(scale(level.travelMs), travelFloorMs(level, cycle)) };
}
