import { stageScript } from '@chags/content';
import type { AllusionContent } from '@chags/content';
import { SplitLevelSchema } from '@chags/templates/schemas';
import type { SplitLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function splitLevel(content: AllusionContent): SplitLevel {
  return SplitLevelSchema.parse(stageScript(content, 'split'));
}
