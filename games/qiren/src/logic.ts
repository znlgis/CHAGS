import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { PlaceLevelSchema } from '@chags/templates/schemas';
import type { PlaceLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function placeLevel(content: ContentEntry): PlaceLevel {
  return PlaceLevelSchema.parse(stageScript(content, 'place'));
}
