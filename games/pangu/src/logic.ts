import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { PlaceLevelSchema, TapLevelSchema } from '@chags/templates/schemas';
import type { PlaceLevel, TapLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: ContentEntry): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}

export function placeLevel(content: ContentEntry): PlaceLevel {
  return PlaceLevelSchema.parse(stageScript(content, 'place'));
}
