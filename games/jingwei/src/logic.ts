import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { TapLevelSchema } from '@chags/templates/schemas';
import type { TapLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: ContentEntry): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}
