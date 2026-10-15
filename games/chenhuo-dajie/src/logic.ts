import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { WindowLevelSchema } from '@chags/templates/schemas';
import type { WindowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function windowLevel(content: ContentEntry): WindowLevel {
  return WindowLevelSchema.parse(stageScript(content, 'window'));
}
