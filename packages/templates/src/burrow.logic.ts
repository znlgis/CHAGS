import type { BurrowLevel, BurrowSpot, BurrowWave } from './schemas';

/** 每个洞挖了几铲（没记录的按 0 算） */
export type DigCounts = Record<string, number>;

export interface BurrowState {
  digs: DigCounts;
}

export function digState(digs: DigCounts): BurrowState {
  return { digs: { ...digs } };
}

/** 手指落在哪个土坡上；forgive 让小朋友不用对准 */
export function spotAt(
  x: number,
  y: number,
  level: BurrowLevel,
  forgive = 0,
): BurrowSpot | null {
  let best: BurrowSpot | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const spot of level.spots) {
    const dist = Math.hypot(x - spot.x, y - spot.y);
    if (dist <= spot.radius + forgive && dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}

export function digCount(spotId: string, digs: DigCounts, level: BurrowLevel): number {
  return Math.max(0, Math.min(level.digsNeeded, Math.round(digs[spotId] ?? 0)));
}

/** 这个洞挖通了吗 */
export function isBurrowOpen(spotId: string, digs: DigCounts, level: BurrowLevel): boolean {
  return digCount(spotId, digs, level) >= level.digsNeeded;
}

/** 挖通了的洞口（按关卡里的顺序） */
export function openBurrows(digs: DigCounts, level: BurrowLevel): string[] {
  return level.spots.filter((spot) => isBurrowOpen(spot.id, digs, level)).map((s) => s.id);
}

/**
 * 只数"挖通的洞"：同一个洞反复挖不增加退路，没挖通的也不算。
 * 这就是这个典故的账本。
 */
export function openCount(digs: DigCounts, level: BurrowLevel): number {
  return openBurrows(digs, level).length;
}

/** 洞口比危险守住的还多，就还有路走 */
export function escapeRoute(open: number, blocks: number): boolean {
  return open > blocks;
}

export function waveResult(digs: DigCounts, wave: BurrowWave, level: BurrowLevel): 'safe' | 'trapped' {
  return escapeRoute(openCount(digs, level), wave.blocks) ? 'safe' : 'trapped';
}

/** 要几个洞才躲得过 —— 最凶的那一次危险守住几个，就得多一个（狡兔三窟的"三"就在这儿） */
export function neededBurrows(level: BurrowLevel): number {
  return Math.max(...level.waves.map((wave) => wave.blocks)) + 1;
}

/** 下一次危险要守住哪些洞口：先守已经挖通的那些（孩子的退路被掐掉才看得见） */
export function blockedBy(digs: DigCounts, wave: BurrowWave, level: BurrowLevel): string[] {
  return openBurrows(digs, level).slice(0, wave.blocks);
}

/** 下一个该挖的土坡：还没挖通、而且挖得最深的那一个（无头验证与提示都用它） */
export function nextSpotToDig(digs: DigCounts, level: BurrowLevel): BurrowSpot | undefined {
  const unfinished = level.spots.filter((spot) => !isBurrowOpen(spot.id, digs, level));
  if (unfinished.length === 0) return undefined;
  return unfinished.reduce((best, spot) =>
    digCount(spot.id, digs, level) > digCount(best.id, digs, level) ? spot : best,
  );
}
