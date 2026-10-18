import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { RuseLevelSchema } from '@chags/templates/schemas';
import type { RuseLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function ruseLevel(content: ContentEntry): RuseLevel {
  return RuseLevelSchema.parse(stageScript(content, 'ruse'));
}
