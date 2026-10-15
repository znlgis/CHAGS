import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { ReadLevelSchema } from '@chags/templates/schemas';
import type { ReadLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function readLevel(content: ContentEntry): ReadLevel {
  return ReadLevelSchema.parse(stageScript(content, 'read'));
}
