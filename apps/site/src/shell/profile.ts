/**
 * 发布形态（build profile）。
 *
 * 同一个仓库出两种包：
 * - **完整版**（默认）：53 款 —— 17 个典故 + 36 计，GitHub Pages / 桌面 / 安卓都用它；
 * - **Toy 版**（`VITE_TOY=1 pnpm build`）：只上 14 款典故。
 *
 * 为什么要有这一层：2026-11 两次提 Toy 都被「内容审核未通过（请检查 Toy 中的文案和图片内容）」退回，
 * 而产物里的敏感字面在第一轮就清到 0 了。剩下的差异只剩**题材**：三十六计逐关在教"怎么用计"，
 * 后羿射日 / 百步穿杨 / 庖丁解牛带弓箭与刀具画面 —— 对儿童向 Toy 属于高风险，不值得为了审过反复改内容。
 * 所以 Toy 版先只上典故，三十六计留在完整版里，随时可以开关。
 *
 * ★ 过滤只发生在**外壳**（大厅 / 图鉴 / 注册表），内容层一行没改 ——
 *   `content:check`、单测、完整版行为全部保持原样。
 */

/** 是否 Toy 发布形态（构建期决定，运行时只读） */
export const TOY_PROFILE = import.meta.env.VITE_TOY === '1';

/** Toy 版不上的分组 */
const HIDDEN_GROUPS = new Set(['stratagem']);

/**
 * Toy 版不上的单条：
 * - houyi / yangyouji：射日与射柳，满屏弓箭；
 * - paoding：解牛，画面是骨架与刀具。
 */
const HIDDEN_IDS = new Set(['houyi', 'yangyouji', 'paoding']);

export function isGroupVisible(groupId: string): boolean {
  return !TOY_PROFILE || !HIDDEN_GROUPS.has(groupId);
}

export function isEntryVisible(entryId: string): boolean {
  return !TOY_PROFILE || !HIDDEN_IDS.has(entryId);
}

/** 把分组表按发布形态过滤；空组在 Toy 版里直接不摆（完整版照旧显示"敬请期待"） */
export function filterGroups<T extends { group: { id: string } }>(sections: T[]): T[] {
  if (!TOY_PROFILE) return sections;
  return sections.filter((section) => isGroupVisible(section.group.id));
}

/** 过滤组内条目 */
export function filterEntries<T extends { id: string }>(items: T[]): T[] {
  if (!TOY_PROFILE) return items;
  return items.filter((item) => isEntryVisible(item.id));
}
