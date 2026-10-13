import { stageScript } from '@chags/content';
import type { AllusionContent } from '@chags/content';
import { TapLevelSchema } from '@chags/templates/schemas';
import type { TapLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: AllusionContent): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}
