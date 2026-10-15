import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import { SortLevelSchema } from '@chags/templates/schemas';
import type { SortLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function sortLevel(content: ContentEntry): SortLevel {
  return SortLevelSchema.parse(stageScript(content, 'sort'));
}
