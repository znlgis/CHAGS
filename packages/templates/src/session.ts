/** 一局游戏内的过程数据：星星与复习评级都由它推导，避免各场景各算一套 */
export interface SessionState {
  startedAt: number;
  mistakes: number;
  correct: number;
  total: number;
}

export function createSessionState(now: number): SessionState {
  return { startedAt: now, mistakes: 0, correct: 0, total: 0 };
}

/** 对小朋友永远给星星：1~3 星，没有 0 星 */
export function starsFor(session: SessionState): 1 | 2 | 3 {
  if (session.mistakes <= 1) return 3;
  if (session.mistakes <= 3) return 2;
  return 1;
}
