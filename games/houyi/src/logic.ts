import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { AimLevelSchema } from '@chags/templates/schemas';
import type { AimLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function aimLevel(content: ContentEntry): AimLevel {
  return AimLevelSchema.parse(stageScript(content, 'aim'));
}
