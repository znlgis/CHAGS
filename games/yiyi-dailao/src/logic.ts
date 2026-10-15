import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { StillnessLevelSchema } from '@chags/templates/schemas';
import type { StillnessLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function stillnessLevel(content: ContentEntry): StillnessLevel {
  return StillnessLevelSchema.parse(stageScript(content, 'stillness'));
}
