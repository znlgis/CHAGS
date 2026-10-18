import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { ButcherLevel, ButcherPiece } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function butcherLevel(content: ContentEntry): ButcherLevel {
  return asLevel<ButcherLevel>(stageScript(content, 'butcher'));
}

export type PushOutcome = 'along' | 'wrong-way' | 'too-short';

export interface PushInput {
  dx: number;
  dy: number;
}

/** 两个角度之间的最小夹角（0..180） */
export function angleGapDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

export function pushAngleDeg(drag: PushInput): number {
  return (Math.atan2(drag.dy, drag.dx) * 180) / Math.PI;
}

/**
 * 顺着缝推：方向对得上、而且真的推动了，这一块就滑开。
 * 推错了不惩罚 —— 只是推不动，刀还是那把好刀（缺口只来自第一刀硬砍）。
 */
export function pushOutcome(
  piece: ButcherPiece,
  drag: PushInput,
  toleranceDeg = 55,
  minDistance = 64,
): PushOutcome {
  if (Math.hypot(drag.dx, drag.dy) < minDistance) return 'too-short';
  return angleGapDeg(pushAngleDeg(drag), piece.grooveDeg) <= toleranceDeg
    ? 'along'
    : 'wrong-way';
}

/** 手指落在哪一块上（先看离得最近的那一块） */
export function pieceAt(
  x: number,
  y: number,
  level: ButcherLevel,
  forgive = 0,
): ButcherPiece | null {
  let best: ButcherPiece | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const piece of level.pieces) {
    const dist = Math.hypot(x - piece.x, y - piece.y);
    if (dist <= piece.radius + forgive && dist < bestDist) {
      best = piece;
      bestDist = dist;
    }
  }
  return best;
}

/** 全部解开 */
export function isButcherComplete(level: ButcherLevel, openedIds: readonly string[]): boolean {
  return level.pieces.every((piece) => openedIds.includes(piece.id));
}

/** 剩下的块数不多了 —— 最后几块不给提示："以神遇而不以目视" */
export function isHintless(level: ButcherLevel, openedIds: readonly string[]): boolean {
  const left = level.pieces.length - openedIds.length;
  return left <= level.blindTail;
}

/** 刀口的账：砍到骨头才缺口，顺着缝走十九年也不缺一个口子 */
export function nickCount(base: number, outcome: PushOutcome | 'blind-cut'): number {
  return outcome === 'along' || outcome === 'too-short' ? base : base + 1;
}
