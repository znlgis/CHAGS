/**
 * "点哪都行"点击区的连点保护（`BaseScene.tapToContinue` 用）。
 *
 * 规矩只有一条：**上一次真的翻页之后 TAP_LOCK_MS 之内的点击不算数**。
 * 它挡的是孩子连点两下时，第二下落在**下一幕刚建好的**点击区上，一屏故事被整段跳过去。
 *
 * 刻意**不从"点击区建好的时刻"起算**：一幕念完（`story:ready`）到孩子抬手之间可能只隔
 * 几十毫秒，从建区起算会把这一下**正常**的点击一起吞掉 —— 屏幕上小手刚出现，点下去却毫无
 * 反应（既没翻页也没提示，因为护盾已经撤了）。e2e 里复现过：听完了却进不了玩法。
 */
export const TAP_LOCK_MS = 350;

/** 上一次翻页之后，点击区要到这个时刻才接受点击 */
export function tapArmedAt(lastAdvanceAt: number): number {
  return lastAdvanceAt + TAP_LOCK_MS;
}

/** `now` 与 `lastAdvanceAt` 取同一个墙钟（`ctx.services.now()`） */
export function isTapArmed(now: number, lastAdvanceAt: number): boolean {
  return now >= tapArmedAt(lastAdvanceAt);
}
