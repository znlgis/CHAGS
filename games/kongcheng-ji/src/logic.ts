import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { StillnessCalmSchema } from '@chags/templates/schemas';
import type { StillnessCalmLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function kongchengLevel(content: ContentEntry): StillnessCalmLevel {
  return StillnessCalmSchema.parse(stageScript(content, 'stillness'));
}
