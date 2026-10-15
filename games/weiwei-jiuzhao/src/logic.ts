import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { SiegeLevelSchema } from '@chags/templates/schemas';
import type { SiegeLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function siegeLevel(content: ContentEntry): SiegeLevel {
  return SiegeLevelSchema.parse(stageScript(content, 'siege'));
}
