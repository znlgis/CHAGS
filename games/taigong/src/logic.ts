import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import { WaitLevelSchema } from '@chags/templates/schemas';
import type { WaitLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function waitLevel(content: ContentEntry): WaitLevel {
  return WaitLevelSchema.parse(stageScript(content, 'wait'));
}
