import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { StillnessFeignLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function jiachiLevel(content: ContentEntry): StillnessFeignLevel {
  return asLevel<StillnessFeignLevel>(stageScript(content, 'stillness'));
}
