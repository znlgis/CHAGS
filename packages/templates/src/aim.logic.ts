export interface AimPoint {
  x: number;
  y: number;
}

export interface AimTargetPoint extends AimPoint {
  id: string;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 瞄准方向（单位向量）；拉得太短视为无效射击 */
export function aimDirection(from: AimPoint, to: AimPoint, minDistance = 40): AimPoint | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < minDistance) return null;
  return { x: dx / length, y: dy / length };
}

/** 拉弓程度 0..1，用来画弓弦与决定箭速 */
export function pullAmount(from: AimPoint, to: AimPoint, fullAt = 220): number {
  return clamp01(Math.hypot(to.x - from.x, to.y - from.y) / fullAt);
}

/** 点到线段的最短距离：箭很快，必须按"这一帧扫过的线段"判定，否则会穿过去 */
export function distanceToSegment(p: AimPoint, a: AimPoint, b: AimPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 目标在线段上的投影位置（0..1）：用来判断"箭先碰到谁" */
export function projectionT(p: AimPoint, a: AimPoint, b: AimPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return 0;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  return Math.min(1, Math.max(0, t));
}

/**
 * 这一帧里被命中的目标。
 * 命中半径内可能有多个，取**沿弹道最先碰到的那一个** —— 这才是箭的语义；
 * 只按垂直距离取最近会在几发并排时选错。
 */
export function firstHit(
  from: AimPoint,
  to: AimPoint,
  targets: readonly AimTargetPoint[],
  radius: number,
  /** 可选：每个目标自己的命中半径（百步穿杨：越远的那片柳叶越小） */
  radiusOf?: (target: AimTargetPoint) => number,
): string | null {
  let best: string | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (distanceToSegment(target, from, to) > (radiusOf ? radiusOf(target) : radius)) continue;
    const t = projectionT(target, from, to);
    if (t < bestT) {
      best = target.id;
      bestT = t;
    }
  }
  return best;
}
/** 距离阶梯：第 index 档（越界返回 undefined） */
export function rungFor<T extends { id: string }>(
  rungs: readonly T[],
  index: number,
): T | undefined {
  return rungs[index];
}

/** 距离阶梯：某一档对应的靶子 id */
export function rungTarget(
  rungs: readonly { targetId: string }[],
  index: number,
): string | undefined {
  return rungs[index]?.targetId;
}
