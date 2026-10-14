import type { SortBin, SortItem, SortLevel } from './schemas';

/** 找落点最近的木牍；dropForgive 让小朋友不用对准 */
export function binAt(
  x: number,
  y: number,
  level: SortLevel,
  dropForgive = 0,
): SortBin | null {
  let best: SortBin | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const bin of level.bins) {
    const dist = Math.hypot(x - bin.x, y - bin.y);
    if (dist <= bin.radius + dropForgive && dist < bestDist) {
      best = bin;
      bestDist = dist;
    }
  }
  return best;
}

/** 这件东西该去哪个木牍 */
export function binFor(level: SortLevel, item: SortItem): SortBin | undefined {
  return level.bins.find((b) => b.id === item.binId);
}

export function isSortCorrect(item: SortItem, bin: SortBin): boolean {
  return item.binId === bin.id;
}

/** 归位数：同一件东西放两次只算一次，认不出的 id 直接忽略 */
function filledCount(level: SortLevel, placedIds: string[]): number {
  const wanted = new Set(level.items.map((i) => i.id));
  return new Set(placedIds.filter((id) => wanted.has(id))).size;
}

export function isSortComplete(level: SortLevel, placedIds: string[]): boolean {
  return filledCount(level, placedIds) >= level.items.length;
}

export function sortProgress(level: SortLevel, placedIds: string[]): number {
  return level.items.length === 0 ? 1 : filledCount(level, placedIds) / level.items.length;
}

/** 某个木牍里已经放了几件（画木牍上的计数用） */
export function placedIn(bin: SortBin, level: SortLevel, placedIds: string[]): number {
  const placed = new Set(placedIds);
  return level.items.filter((item) => item.binId === bin.id && placed.has(item.id)).length;
}

/**
 * "先尝后分"：这件东西还没尝过吗？
 * 没有 probe 的关卡永远返回 false —— 分类玩法可以不带品尝步骤，直接用。
 */
export function needsTaste(
  level: SortLevel,
  item: SortItem,
  tastedIds: string[],
): boolean {
  return level.probe !== undefined && !tastedIds.includes(item.id);
}

/** 还没尝过的第一件（卡住提示与无头验证都靠它） */
export function nextUntasted(level: SortLevel, tastedIds: string[]): SortItem | undefined {
  return level.items.find((item) => needsTaste(level, item, tastedIds));
}

/** 落点是不是"尝一口"的地方（神农的嘴边） */
export function probeHit(x: number, y: number, level: SortLevel, dropForgive = 0): boolean {
  const probe = level.probe;
  if (!probe) return false;
  return Math.hypot(x - probe.x, y - probe.y) <= probe.radius + dropForgive;
}
