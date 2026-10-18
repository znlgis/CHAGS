import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { TwolineLevelSchema } from '@chags/templates/schemas';
import type { TwolineLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function twolineLevel(content: ContentEntry): TwolineLevel {
  return TwolineLevelSchema.parse(stageScript(content, 'twoline'));
}
