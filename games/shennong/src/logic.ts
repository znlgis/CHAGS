import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import type { SortLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function sortLevel(content: ContentEntry): SortLevel {
  return asLevel<SortLevel>(stageScript(content, 'sort'));
}
