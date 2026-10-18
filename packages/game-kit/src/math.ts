/**
 * 纯数字工具 —— 与 Phaser / DOM 无关，游戏包与模板层都能用。
 *
 * clamp01 以前在 17 个游戏的 art.ts 与 4 个模板 logic 里各写一份（共 21 份），
 * 语义一模一样：把值夹到 0..1。重复实现的问题是改一处不会改另一处。
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
