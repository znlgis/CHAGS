import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { SiegeSupportSchema } from '@chags/templates/schemas';
import type { SiegeSupportLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function fudiLevel(content: ContentEntry): SiegeSupportLevel {
  return SiegeSupportSchema.parse(stageScript(content, 'siege'));
}
