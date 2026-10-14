import type { WaitLevel } from './schemas';

/** 等待状态：只记"被诱惑往后推了多少"，已经等了多久由墙钟算 */
export interface WaitState {
  penaltyMs: number;
  hits: number;
}

export function waitStart(): WaitState {
  return { penaltyMs: 0, hits: 0 };
}

/** 这次等待总共要多久 */
export function waitRequired(level: WaitLevel, state: WaitState): number {
  return level.durationMs + state.penaltyMs;
}

export function isWaitDone(level: WaitLevel, state: WaitState, elapsedMs: number): boolean {
  return elapsedMs >= waitRequired(level, state);
}

export function waitProgress(level: WaitLevel, state: WaitState, elapsedMs: number): number {
  const required = waitRequired(level, state);
  return required <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / required));
}

/**
 * 点了一次诱惑：把终点往后推一点。
 * 推满 penaltyCap 次之后只回应、不再延后 —— "分心就得多等一会儿"，但不能等不到头。
 */
export function applyTemptation(
  level: WaitLevel,
  state: WaitState,
  penaltyMs: number,
): WaitState {
  if (state.hits >= level.penaltyCap) return state;
  return { penaltyMs: state.penaltyMs + Math.max(0, penaltyMs), hits: state.hits + 1 };
}

/** 点老人时轮着说的话 */
export function lineAt(level: WaitLevel, index: number): string {
  return level.lines[index % level.lines.length]!;
}

/** 无头验证：把 45 秒压成 7 秒以内，e2e 不能真等 */
export function effectiveDuration(
  level: WaitLevel,
  autoplay: boolean,
  factor = 7,
): number {
  if (!autoplay) return level.durationMs;
  return Math.max(1500, Math.round(level.durationMs / factor));
}
