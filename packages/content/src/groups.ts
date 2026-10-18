/**
 * 分组：小游戏合集的第一层结构。
 *
 * 现在有两组 —— 典故 与 三十六计；**以后还会有更多组**，
 * 所以这里不写死任何两组的假设：大厅、图鉴、内容体检全部按这张表遍历。
 *
 * 加一个新分组只要三步：
 * 1. 在这里加一行（id / order / orderBy）；
 * 2. 在 packages/i18n/src/messages.ts 里补 group.<id>.title / .note / .empty
 *    （少写一个就编译报错，和英文表完整性同一个套路）；
 * 3. 把新组的关卡内容加进来并在 entries/index.ts 登记（空组也能先建，
 *    大厅会显示成"敬请期待"）。
 */
export interface GameGroup {
  id: string;
  /** 排在前面的组先显示 */
  order: number;
  /**
   * 组内怎么排序：
   * - year：按 yearApprox —— 典故用（历史长卷从上古走到明清）
   * - index：按内容数组里的登记顺序 —— 三十六计用（按计策序号排，年代反而会打乱）
   */
  orderBy: 'year' | 'index';
}

/** 三十六计一共六套（胜战 / 敌战 / 攻战 / 混战 / 并战 / 败战），套名是界面文案，见 i18n */
export const STRATAGEM_SETS = 6;

export const GROUPS = [
  { id: 'allusion', order: 10, orderBy: 'year' },
  { id: 'stratagem', order: 20, orderBy: 'index' },
] as const satisfies readonly GameGroup[];

export type GroupId = (typeof GROUPS)[number]['id'];

export function isGroupId(value: string): value is GroupId {
  return GROUPS.some((group) => group.id === value);
}

export function findGroup(id: string): GameGroup | undefined {
  return (GROUPS as readonly GameGroup[]).find((group) => group.id === id);
}

/** 分组按 order 升序 —— 大厅与图鉴都直接用这个顺序 */
export function sortedGroups(): GameGroup[] {
  return [...(GROUPS as readonly GameGroup[])].sort((a, b) => a.order - b.order);
}

/**
 * 把条目按分组归档。
 * **空组也会出现**：三十六计现在还没有游戏，但它必须在大厅里占一个位置 ——
 * 不然"分组"这件事就只是数据结构里的一行，用户看不到。
 */
export function groupBy<T extends { group: string }>(
  items: readonly T[],
): { group: GameGroup; items: T[] }[] {
  return sortedGroups().map((group) => ({
    group,
    items: items.filter((item) => item.group === group.id),
  }));
}
