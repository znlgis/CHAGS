import type { AllusionContent } from '@chags/content';
import { stageScript } from '@chags/content';
import { TapLevelSchema, TraceLevelSchema } from '@chags/templates/schemas';
import type { TapLevel, TraceLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: AllusionContent): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}

export function traceLevel(content: AllusionContent): TraceLevel {
  return TraceLevelSchema.parse(stageScript(content, 'trace'));
}
