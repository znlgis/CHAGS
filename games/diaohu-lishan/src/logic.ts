import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { LureLevelSchema } from '@chags/templates/schemas';
import type { LureLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function lureLevel(content: ContentEntry): LureLevel {
  return LureLevelSchema.parse(stageScript(content, 'lure'));
}
