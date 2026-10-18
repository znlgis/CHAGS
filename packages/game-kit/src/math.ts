/**
 * 纯数字工具 —— 与 Phaser / DOM 无关，游戏包与模板层都能用。
 *
 * clamp01 以前在 17 个游戏的 art.ts 与 4 个模板 logic 里各写一份（共 21 份），
 * 语义一模一样：把值夹到 0..1。重复实现的问题是改一处不会改另一处。
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 把关卡脚本断言成模板的关卡类型。
 *
 * **生产包里不再跑 zod**：内容在构建期由 `pnpm content:check` 用同一套 schema 全量校验
 * （CI 与发版都跑），运行时 parse 只会把 zod + 全部模板 schema 拖进游戏 chunk（约 39 KB gzip）。
 * 开发服务器里仍有校验：`defineGame.mount()` 的 DEV 分支会动态 import 模板 schema 校验一次；
 * 单测（vitest）里的负例直接对 schema 断言（见各 `logic.test.ts`）。
 *
 * 放在 game-kit（纯逻辑层）而不是 templates：游戏包的 `logic.ts` 必须能在 Node 里被单测导入，
 * 而 templates 的入口会间接 import Phaser。
 */
export function asLevel<T>(script: unknown): T {
  return script as T;
}
