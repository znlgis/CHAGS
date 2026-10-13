import { stageScript } from '@chags/content';
import type { AllusionContent } from '@chags/content';
import { GrowLevelSchema, PlaceLevelSchema } from '@chags/templates/schemas';
import type { GrowLevel, PlaceLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function growLevel(content: AllusionContent): GrowLevel {
  return GrowLevelSchema.parse(stageScript(content, 'grow'));
}

export function placeLevel(content: AllusionContent): PlaceLevel {
  return PlaceLevelSchema.parse(stageScript(content, 'place'));
}
