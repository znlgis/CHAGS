import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { SwapLevelSchema } from '@chags/templates/schemas';
import type { SwapLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function jinchanLevel(content: ContentEntry): SwapLevel {
  return SwapLevelSchema.parse(stageScript(content, 'swap'));
}
