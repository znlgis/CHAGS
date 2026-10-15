import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { SwapBeamSchema } from '@chags/templates/schemas';
import type { SwapBeamLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function touliangLevel(content: ContentEntry): SwapBeamLevel {
  return SwapBeamSchema.parse(stageScript(content, 'swap'));
}
