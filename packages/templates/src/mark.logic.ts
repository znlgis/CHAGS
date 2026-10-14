import type { MarkLevel, MarkSurface } from './schemas';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 船漂了多远（世界像素）：progress 是 0..1 的漂移进度 */
export function driftOffset(progress: number, driftDistance: number): number {
  return clamp01(progress) * driftDistance;
}

/**
 * 记号此刻在世界坐标里的位置。
 * **这就是这个典故的全部**：刻在船上的记号跟着船走，刻在岸上的记号一动不动。
 */
export function surfaceWorldX(surface: MarkSurface, driftPx: number): number {
  return surface.x + (surface.drifts ? driftPx : 0);
}

/** 从记号处下水，够不够得着剑 */
export function reachSword(surface: MarkSurface, driftPx: number, level: MarkLevel): boolean {
  return Math.abs(surfaceWorldX(surface, driftPx) - level.sword.x) <= level.sword.radius;
}

/** 刻这个面、漂了这么远，下水会捞到什么 */
export function markResult(
  surface: MarkSurface,
  driftPx: number,
  level: MarkLevel,
): 'found' | 'miss' {
  return reachSword(surface, driftPx, level) ? 'found' : 'miss';
}

/** 手指落在哪个面上；forgive 让小朋友不用对准 */
export function surfaceAt(
  x: number,
  y: number,
  level: MarkLevel,
  forgive = 0,
): MarkSurface | null {
  let best: MarkSurface | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const surface of level.surfaces) {
    const dist = Math.hypot(x - surface.x, y - surface.y);
    if (dist <= surface.radius + forgive && dist < bestDist) {
      best = surface;
      bestDist = dist;
    }
  }
  return best;
}

/** 已经刻过的面里，有没有一个能捞到剑 */
export function foundWith(
  level: MarkLevel,
  markedIds: readonly string[],
  driftPx: number,
): boolean {
  return level.surfaces.some(
    (surface) => markedIds.includes(surface.id) && reachSword(surface, driftPx, level),
  );
}

/**
 * 捞空之后，该把小手放到哪个面上 —— 一定要有一个能捞到的（零失败）。
 * 先找"此刻真的够得着"的；数据万一写歪了，退回到任何一个不会动的面。
 */
export function hintSurface(level: MarkLevel, driftPx: number): MarkSurface | undefined {
  return (
    level.surfaces.find((surface) => reachSword(surface, driftPx, level)) ??
    level.surfaces.find((surface) => !surface.drifts)
  );
}
