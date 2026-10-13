import type { AllusionContent } from '@chags/content';
import { gradeFromScore } from '@chags/progress';
import { BalanceLevelSchema } from '@chags/templates/schemas';
import type { BalanceLevel } from '@chags/templates/schemas';
import type { SessionState } from '@chags/templates/session';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function balanceLevel(script: AllusionContent['game']['levelScript']): BalanceLevel {
  return BalanceLevelSchema.parse(script);
}

export function gradeOfRun(session: SessionState): 0 | 1 | 2 | 3 {
  return gradeFromScore(session.correct, session.total);
}
