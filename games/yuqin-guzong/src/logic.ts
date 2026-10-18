import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { ChaseLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function chaseLevel(content: ContentEntry): ChaseLevel {
  return asLevel<ChaseLevel>(stageScript(content, 'chase'));
}
