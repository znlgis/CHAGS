import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { SubstitutionLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function substitutionLevel(content: ContentEntry): SubstitutionLevel {
  return asLevel<SubstitutionLevel>(stageScript(content, 'substitution'));
}
