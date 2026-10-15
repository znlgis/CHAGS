import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { BurrowLevelSchema } from '@chags/templates/schemas';
import type { BurrowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function burrowLevel(content: ContentEntry): BurrowLevel {
  return BurrowLevelSchema.parse(stageScript(content, 'burrow'));
}
