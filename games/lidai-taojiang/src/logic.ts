import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { MatchupLevelSchema } from '@chags/templates/schemas';
import type { MatchupLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function matchupLevel(content: ContentEntry): MatchupLevel {
  return MatchupLevelSchema.parse(stageScript(content, 'matchup'));
}
