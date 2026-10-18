import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { TwolineLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function twolineLevel(content: ContentEntry): TwolineLevel {
  return asLevel<TwolineLevel>(stageScript(content, 'twoline'));
}
