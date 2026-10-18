import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { MatchupOrderLevelSchema } from '@chags/templates/schemas';
import type { MatchupOrderLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测（这一关只有 order 那一半） */
export function matchupLevel(content: ContentEntry): MatchupOrderLevel {
  return MatchupOrderLevelSchema.parse(stageScript(content, 'matchup'));
}
