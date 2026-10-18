import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { BorrowLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function borrowLevel(content: ContentEntry): BorrowLevel {
  return asLevel<BorrowLevel>(stageScript(content, 'borrow'));
}
