import type { WindowJob, WindowLevel } from './schemas';

/**
 * 时机窗口：活儿谁都会干，难的是**等对时候**。
 *
 * 对方的营地按周期在"稳"与"乱"之间摆：
 * - calm：靠近就会被赶回来，点它什么也不发生；
 * - warn：巡逻的灯刚转过去（窗口要开了的征兆）；
 * - window：可以干活 —— 点一下推进 `workTapMs` 的活儿。
 *
 * 窗口关上的时候，**没干完的活儿进度清零**（零惩罚，下个窗口接着干）。
 * 干完 `goal` 件就算成功 —— 这就是"趁火打劫"落在"看清时机"上的那一半。
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
 */
export function tapAt(
  state: WindowState,
  level: WindowLevel,
  jobId: string,
  t: number,
  warnMs: number = WINDOW_WARN_MS,
): WindowState {
  if (phaseAt(level, t, warnMs) !== 'window') return state;
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

export function effectiveCycle(
  level: WindowLevel,
  autoplay: boolean,
  factor = 3,
): WindowLevel {
  if (!autoplay || factor <= 1) return level;
  const scale = (ms: number): number => Math.max(WINDOW_MIN_PHASE_MS, Math.round(ms / factor));
  return {
    ...level,
    cycle: { calmMs: scale(level.cycle.calmMs), windowMs: scale(level.cycle.windowMs) },
  };
}
