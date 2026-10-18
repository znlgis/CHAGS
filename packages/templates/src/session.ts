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

/**
 * 记一次尝试 —— 场景里"这一下算不算做对"只走这一个口子。
 *
 * total 是"试了几次"，correct 是"成了几次"，mistakes 是"错了几次"：
 * - ok = true：total + 1、correct + 1；
 * - ok = false：total + 1、mistakes + 1（做错也是一次尝试）。
 *
 * 以前 20 个模板只在成功时把 total 与 correct 一起 +1，于是 correct / total 恒为 1：
 * 复习评级（PlayView 按答对率算）永远满分；星星只看 mistakes，也就永远是 3 颗。
 * 失败也记进 total 之后，两条线才恢复真实。
 *
 * "零惩罚"的口径没有变：做错不会结束这一局、不会锁住操作、不会扣掉已经拿到的星星；
 * 它只影响这一局拿几颗星（starsFor）与下次复习间隔（PlayView 的 reviewGrade）。
 */
export function recordAttempt(session: SessionState, attempt: { ok: boolean }): void {
  session.total += 1;
  if (attempt.ok) session.correct += 1;
  else session.mistakes += 1;
}

/** 对小朋友永远给星星：1~3 星，没有 0 星 */
export function starsFor(session: SessionState): 1 | 2 | 3 {
  if (session.mistakes <= 1) return 3;
  if (session.mistakes <= 3) return 2;
  return 1;
}
