import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { SiegeLadderSchema } from '@chags/templates/schemas';
import type { SiegeLadderLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function shangwuLevel(content: ContentEntry): SiegeLadderLevel {
  return SiegeLadderSchema.parse(stageScript(content, 'siege'));
}
