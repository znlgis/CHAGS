import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { SiegeCloseSchema } from '@chags/templates/schemas';
import type { SiegeCloseLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function guanmenLevel(content: ContentEntry): SiegeCloseLevel {
  return SiegeCloseSchema.parse(stageScript(content, 'siege'));
}
