import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { StillnessFeignSchema } from '@chags/templates/schemas';
import type { StillnessFeignLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function jiachiLevel(content: ContentEntry): StillnessFeignLevel {
  return StillnessFeignSchema.parse(stageScript(content, 'stillness'));
}
