import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { MarkLevelSchema } from '@chags/templates/schemas';
import type { MarkLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function markLevel(content: ContentEntry): MarkLevel {
  return MarkLevelSchema.parse(stageScript(content, 'mark'));
}
