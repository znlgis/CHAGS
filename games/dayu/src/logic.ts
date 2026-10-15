import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content/full';
import { TapLevelSchema, TraceLevelSchema } from '@chags/templates/schemas';
import type { TapLevel, TraceLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function tapLevel(content: ContentEntry): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}

export function traceLevel(content: ContentEntry): TraceLevel {
  return TraceLevelSchema.parse(stageScript(content, 'trace'));
}
