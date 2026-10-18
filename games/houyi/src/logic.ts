import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { AimLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function aimLevel(content: ContentEntry): AimLevel {
  return asLevel<AimLevel>(stageScript(content, 'aim'));
}
