import type { StillnessBeat, StillnessLevel } from './schemas';

/**
 * 忍：最难的动作是不动。
 *
 * 这一关的账本只有一条 —— **鼓响的时候出手，等于把力气白送给对方**。
 * 鼓一通接一通地响（beat 按时间顺序排），只有 correct 那一通的窗口里出手才算数；
 * 在别的时候出手只记一次"白费力气"，不扣星、不结束，接着等就是。
 *
 * 判定全部按**时间轴**算（t 是从这一轮开始算起的毫秒数）：
 * 场景用墙钟喂 t，单测直接喂数字 —— 同一份判定，两边不会跑偏。
 */

export type StillnessPhase = 'drum' | 'window' | 'done';

/** 出击的结果：打中了 / 白费力气 / 现在不该出手（没这回事，什么也不记） */
export type StrikeResult = 'hit' | 'early' | 'idle';

export interface StillnessPhaseInfo {
  /** 此刻这一通鼓是谁；整条时间轴走完了就是 null */
  beatId: string | null;
  phase: StillnessPhase;
}

/** 一局里攒下来的东西：只记"白费力气了几次"，不记惩罚 */
export interface StillnessState {
  /** 已经在正确的窗口里出手了 */
  done: boolean;
  /** 白费力气了几次（不扣星，只用来复盘） */
  early: number;
  /** 每一次白鼓是在哪一通上 —— 提示语与复盘用 */
  earlyBeatIds: string[];
}

/** 一通鼓在时间轴上的位置（关卡数据里只写时长，位置是累积算出来的） */
export interface BeatSlot {
  beat: StillnessBeat;
  index: number;
  drumStartMs: number;
  /** 鼓停之后的窗口从这儿开始 */
  windowStartMs: number;
  /** 窗口关上、进入下一通 */
  endMs: number;
}

export function stillnessStart(): StillnessState {
  return { done: false, early: 0, earlyBeatIds: [] };
}

/** 无头验证时每一通至少留这么久，否则窗口短得点都点不到 */
export const STILLNESS_MIN_BEAT_MS = 240;

export function timeline(level: StillnessLevel): BeatSlot[] {
  let cursor = 0;
  return level.beats.map((beat, index) => {
    const drumStartMs = cursor;
    const windowStartMs = drumStartMs + beat.drumMs;
    const endMs = windowStartMs + beat.windowMs;
    cursor = endMs;
    return { beat, index, drumStartMs, windowStartMs, endMs };
  });
}

/** 三通鼓响完总共多久 */
export function totalMs(level: StillnessLevel): number {
  const slots = timeline(level);
  return slots.length === 0 ? 0 : slots[slots.length - 1]!.endMs;
}

/** 此刻落在哪一通鼓上；走完了就是 null */
export function slotAt(level: StillnessLevel, t: number): BeatSlot | null {
  const ms = Math.max(0, t);
  return timeline(level).find((slot) => ms < slot.endMs) ?? null;
}

/** 此刻的鼓面状态：这一通鼓鼓声响着、还是鼓停了在等窗口 */
export function phaseAt(level: StillnessLevel, t: number): StillnessPhaseInfo {
  const slot = slotAt(level, t);
  if (!slot) return { beatId: null, phase: 'done' };
  return {
    beatId: slot.beat.id,
    phase: Math.max(0, t) < slot.windowStartMs ? 'drum' : 'window',
  };
}

/**
 * 此刻出击会怎么样？
 * - 'hit'：正好在 correct 那一通的窗口里 —— 一鼓作气，再而衰，三而竭；
 * - 'early'：鼓还在响，或者打在不该出手的那一通上 —— 白费力气；
 * - 'idle'：鼓全敲完了，这一轮已经过去，出手什么也不算。
 */
export function strikeAt(level: StillnessLevel, t: number): StrikeResult {
  const slot = slotAt(level, t);
  if (!slot) return 'idle';
  const inWindow = Math.max(0, t) >= slot.windowStartMs;
  return inWindow && slot.beat.correct ? 'hit' : 'early';
}

/** 此刻出击算不算成功 —— 画面上"可以出手了"的那圈光用它 */
export function canStrikeAt(level: StillnessLevel, t: number): boolean {
  return strikeAt(level, t) === 'hit';
}

/** 出了一次手：打中就是做完了，白鼓就记一笔（**不惩罚，继续等**） */
export function applyStrike(
  level: StillnessLevel,
  state: StillnessState,
  t: number,
): StillnessState {
  const result = strikeAt(level, t);
  if (result === 'idle') return state;
  if (result === 'hit') return { ...state, done: true };
  const info = phaseAt(level, t);
  return {
    ...state,
    early: state.early + 1,
    earlyBeatIds: [...state.earlyBeatIds, info.beatId ?? ''],
  };
}

export function isStillnessDone(state: StillnessState): boolean {
  return state.done;
}

/** 手指落在出击按钮上（宽容度让小朋友不用对准） */
export function hitAction(
  x: number,
  y: number,
  level: StillnessLevel,
  forgive = 0,
): boolean {
  const { action } = level;
  return Math.hypot(x - action.x, y - action.y) <= action.radius + forgive;
}

/** 该出手的那一通 —— 恰好一个，schema 已经保证 */
export function correctBeat(level: StillnessLevel): StillnessBeat | undefined {
  return level.beats.find((beat) => beat.correct);
}

/** 每一通鼓现在到哪儿了（画面上三面鼓一盏一盏地亮） */
export type BeatMark = 'rest' | 'drum' | 'window' | 'passed';

export function beatMarks(level: StillnessLevel, t: number): BeatMark[] {
  const ms = Math.max(0, t);
  return timeline(level).map((slot) => {
    if (ms < slot.drumStartMs) return 'rest';
    if (ms < slot.windowStartMs) return 'drum';
    if (ms < slot.endMs) return 'window';
    return 'passed';
  });
}

/** 这一通鼓已经响到哪儿（0..1）：鼓面波纹按它推 */
export function beatProgress(level: StillnessLevel, t: number): number {
  const slot = slotAt(level, t);
  if (!slot) return 1;
  const span = slot.endMs - slot.drumStartMs;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (Math.max(0, t) - slot.drumStartMs) / span));
}

/** 距离这一通鼓结束还有多久（窗口快关了，画面上会有反应） */
export function remainingInBeatMs(level: StillnessLevel, t: number): number {
  const slot = slotAt(level, t);
  if (!slot) return 0;
  return Math.max(0, slot.endMs - Math.max(0, t));
}

/** 无头验证：把三通鼓压成几分之一 —— 但每一通都留得下点得到 */
export function effectiveLevel(
  level: StillnessLevel,
  autoplay: boolean,
  factor = 5,
): StillnessLevel {
  if (!autoplay || factor <= 1) return level;
  const scale = (ms: number): number => Math.max(STILLNESS_MIN_BEAT_MS, Math.round(ms / factor));
  return {
    ...level,
    beats: level.beats.map((beat) => ({
      ...beat,
      drumMs: scale(beat.drumMs),
      windowMs: scale(beat.windowMs),
    })),
  };
}
