import { stageScript } from '@chags/content';
import type { AllusionContent } from '@chags/content';
import { BurrowLevelSchema } from '@chags/templates/schemas';
import type { BurrowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function burrowLevel(content: AllusionContent): BurrowLevel {
  return BurrowLevelSchema.parse(stageScript(content, 'burrow'));
}
