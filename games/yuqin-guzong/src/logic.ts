import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { ChaseLevelSchema } from '@chags/templates/schemas';
import type { ChaseLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function chaseLevel(content: ContentEntry): ChaseLevel {
  return ChaseLevelSchema.parse(stageScript(content, 'chase'));
}
