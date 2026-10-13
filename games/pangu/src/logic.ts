import { stageScript } from '@chags/content';
import type { AllusionContent } from '@chags/content';
import { PlaceLevelSchema, TapLevelSchema } from '@chags/templates/schemas';
import type { PlaceLevel, TapLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: AllusionContent): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}

export function placeLevel(content: AllusionContent): PlaceLevel {
  return PlaceLevelSchema.parse(stageScript(content, 'place'));
}
