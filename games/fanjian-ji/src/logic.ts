import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { TwolinePlantSchema } from '@chags/templates/schemas';
import type { TwolinePlantLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function fanjianLevel(content: ContentEntry): TwolinePlantLevel {
  return TwolinePlantSchema.parse(stageScript(content, 'twoline'));
}
