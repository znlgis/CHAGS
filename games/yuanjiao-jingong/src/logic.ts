import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { MatchupOrderLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测（这一关只有 order 那一半） */
export function matchupLevel(content: ContentEntry): MatchupOrderLevel {
  return asLevel<MatchupOrderLevel>(stageScript(content, 'matchup'));
}
