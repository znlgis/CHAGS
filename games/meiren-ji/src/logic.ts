import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { LureFavorSchema } from '@chags/templates/schemas';
import type { LureFavorLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function meirenLevel(content: ContentEntry): LureFavorLevel {
  return LureFavorSchema.parse(stageScript(content, 'lure'));
}
