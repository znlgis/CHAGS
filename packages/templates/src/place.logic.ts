import type { PlaceLevel, PlaceOrb, PlaceSlot } from './schemas';

/** 找落点最近的槽位；dropForgive 让小朋友不用对准 */
export function findSlotAt(
  x: number,
  y: number,
  level: PlaceLevel,
  dropForgive = 0,
): PlaceSlot | null {
  let best: PlaceSlot | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const slot of level.slots) {
    const dist = Math.hypot(x - slot.x, y - slot.y);
    if (dist <= slot.radius + dropForgive && dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return best;
}

export function isCorrect(orb: PlaceOrb, slot: PlaceSlot): boolean {
  return orb.slotId === slot.id;
}

/** 同一个洞补两次不算两个 —— 按"补好的槽位数"去重计数 */
function filledCount(level: PlaceLevel, placedSlotIds: string[]): number {
  const wanted = new Set(level.slots.map((s) => s.id));
  return new Set(placedSlotIds.filter((id) => wanted.has(id))).size;
}

export function isPlaceComplete(level: PlaceLevel, placedSlotIds: string[]): boolean {
  return filledCount(level, placedSlotIds) >= level.slots.length;
}

export function placeProgress(level: PlaceLevel, placedSlotIds: string[]): number {
  return level.slots.length === 0 ? 1 : filledCount(level, placedSlotIds) / level.slots.length;
}

export function slotFor(level: PlaceLevel, orb: PlaceOrb): PlaceSlot | undefined {
  return level.slots.find((s) => s.id === orb.slotId);
}
