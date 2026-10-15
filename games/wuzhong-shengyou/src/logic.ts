import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { ShowLevelSchema } from '@chags/templates/schemas';
import type { ShowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function showLevel(content: ContentEntry): ShowLevel {
  return ShowLevelSchema.parse(stageScript(content, 'show'));
}
