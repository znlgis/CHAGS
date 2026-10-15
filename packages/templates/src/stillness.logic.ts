import type { StillnessBeat, StillnessFeignLevel, StillnessLevel, StillnessTest } from './schemas';

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

/* ---------------- feign：假痴不癫（第 27 计） ---------------- */

/**
 * 假痴不癫（feign）的账本：对手一次次来**试探**，试探期里任何一下点击都算露馅
 * （记一笔 slip —— **零惩罚**：不扣星、不结束、不锁操作，接着忍就是）；
 * 试探之间的**空档**里点一下，才推进一步；推够 `steps` 步，机会就成熟了。
 *
 * 三条刻意的设计：
 * - **时间轴就是关卡数据**：每一次试探（testMs）之后跟着一个空档（gapMs），
 *   位置是累积算出来的 —— 场景把墙钟喂进来，单测直接喂数字，用的是同一份判定。
 * - **试探期的点击不是"错误"，是"忍不住"**：只记一笔账。
 *   孩子自己会发现：忍住那几秒，空档一来，一步就顶上去了。
 * - **空档有几个，就能推几步**：`tests` 有几个空档就最多推几步（本辑 steps = 3）——
 *   想推满就得每一次试探都忍住。
 *
 * **不 import Phaser**：判定比画面重要得多。
 */
export type FeignPhase = 'test' | 'gap' | 'done';

export interface FeignPhaseInfo {
  /** 此刻是哪一次试探；整条时间轴走完了就是 null */
  testId: string | null;
  phase: FeignPhase;
}

/** 一局里攒下来的东西：推了几步、露馅几次 —— 两个数都不带惩罚 */
export interface FeignState {
  /** 空档里行动了几次 */
  progress: number;
  /** 试探期露馅了几次（零惩罚，只用来复盘 —— 这一计最好看的一笔账） */
  slips: number;
  /** 每一次露馅是在哪一次试探上 */
  slipTestIds: string[];
  /** 推够 steps 步了 */
  done: boolean;
}

/** 一次试探在时间轴上的位置（关卡数据里只写时长，位置是累积出来的） */
export interface FeignSlot {
  test: StillnessTest;
  index: number;
  /** 试探从这儿开始：这段时间里任何点击都算露馅 */
  testStartMs: number;
  /** 试探结束、空档从这儿开始：这时候才能行动 */
  gapStartMs: number;
  /** 空档结束（下一次试探开始；最后一次就是整局结束） */
  endMs: number;
}

/** 无头验证时每一段至少留这么久，否则空档短得点都点不到 */
export const FEIGN_MIN_PHASE_MS = 240;

export function feignStart(): FeignState {
  return { progress: 0, slips: 0, slipTestIds: [], done: false };
}

export function feignTimeline(level: StillnessFeignLevel): FeignSlot[] {
  let cursor = 0;
  return level.tests.map((test, index) => {
    const testStartMs = cursor;
    const gapStartMs = testStartMs + test.testMs;
    const endMs = gapStartMs + test.gapMs;
    cursor = endMs;
    return { test, index, testStartMs, gapStartMs, endMs };
  });
}

/** 试探一轮走完总共多久 */
export function feignTotalMs(level: StillnessFeignLevel): number {
  const slots = feignTimeline(level);
  return slots.length === 0 ? 0 : slots[slots.length - 1]!.endMs;
}

/** 此刻落在哪一次试探上（试探或它后面的空档）；走完了就是 null */
export function feignSlotAt(level: StillnessFeignLevel, t: number): FeignSlot | null {
  const ms = Math.max(0, t);
  return feignTimeline(level).find((slot) => ms < slot.endMs) ?? null;
}

/**
 * 此刻是"他正盯着"还是"他走开了"。
 * 试探期 = test，空档 = gap，一轮走完 = done（出手什么也不算，要重开一轮）。
 */
export function feignPhaseAt(level: StillnessFeignLevel, t: number): FeignPhaseInfo {
  const slot = feignSlotAt(level, t);
  if (!slot) return { testId: null, phase: 'done' };
  return {
    testId: slot.test.id,
    phase: Math.max(0, t) < slot.gapStartMs ? 'test' : 'gap',
  };
}

/** 此刻是不是空档（画面上"可以悄悄动手了"的那圈光用它） */
export function feignCanAct(level: StillnessFeignLevel, t: number): boolean {
  return feignPhaseAt(level, t).phase === 'gap';
}

/**
 * 动了一下手：
 * - 试探期 → 只记一笔 slip（**零惩罚**，不打断、不结束、不锁操作）；
 * - 空档期 → progress 加一，推够 steps 就是成了；
 * - 一轮走完（done）→ 什么也不记（重开一轮就是了）。
 */
export function tapActionFeign(
  level: StillnessFeignLevel,
  state: FeignState,
  t: number,
): FeignState {
  if (state.done) return state;
  const info = feignPhaseAt(level, t);
  if (info.phase === 'test') {
    return {
      ...state,
      slips: state.slips + 1,
      slipTestIds: [...state.slipTestIds, info.testId ?? ''],
    };
  }
  if (info.phase === 'gap') {
    const progress = Math.min(level.steps, state.progress + 1);
    return { ...state, progress, done: progress >= level.steps };
  }
  return state;
}

/** 推够 steps 步 = 机会成熟了 */
export function isFeignDone(state: FeignState): boolean {
  return state.done;
}

/** 0..1：推了几成（画面上的进度条按它画） */
export function feignProgress(level: StillnessFeignLevel, state: FeignState): number {
  if (level.steps <= 0) return 1;
  return Math.min(1, Math.max(0, state.progress / level.steps));
}

/** 手指落在"悄悄动手"的地方上（宽容度让小朋友不用对准） */
export function hitFeignAction(
  x: number,
  y: number,
  level: StillnessFeignLevel,
  forgive = 0,
): boolean {
  const { action } = level;
  return Math.hypot(x - action.x, y - action.y) <= action.radius + forgive;
}

/** 此刻距离这一段结束还有多久（空档快关了，画面上会有反应） */
export function feignRemainingMs(level: StillnessFeignLevel, t: number): number {
  const slot = feignSlotAt(level, t);
  if (!slot) return 0;
  return Math.max(0, slot.endMs - Math.max(0, t));
}

/** 这一刻走到这一段的几分了（0..1）—— 灯笼扫过来的光按它推 */
export function feignPhaseProgress(level: StillnessFeignLevel, t: number): number {
  const slot = feignSlotAt(level, t);
  if (!slot) return 1;
  const ms = Math.max(0, t);
  if (ms < slot.gapStartMs) {
    const span = slot.gapStartMs - slot.testStartMs;
    return span <= 0 ? 1 : Math.min(1, Math.max(0, (ms - slot.testStartMs) / span));
  }
  const span = slot.endMs - slot.gapStartMs;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (ms - slot.gapStartMs) / span));
}

/** 无头验证：把试探与空档都压成几分之一 —— 但每一段都留得下点得到 */
export function effectiveFeignLevel(
  level: StillnessFeignLevel,
  autoplay: boolean,
  factor = 5,
): StillnessFeignLevel {
  if (!autoplay || factor <= 1) return level;
  const scale = (ms: number): number => Math.max(FEIGN_MIN_PHASE_MS, Math.round(ms / factor));
  return {
    ...level,
    tests: level.tests.map((test) => ({
      ...test,
      testMs: scale(test.testMs),
      gapMs: scale(test.gapMs),
    })),
  };
}
