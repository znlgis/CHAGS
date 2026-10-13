import type { AllusionContent } from '@chags/content';
import { SubstitutionLevelSchema } from '@chags/templates/schemas';
import type { SubstitutionLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function substitutionLevel(
  script: AllusionContent['game']['levelScript'],
): SubstitutionLevel {
  return SubstitutionLevelSchema.parse(script);
}
