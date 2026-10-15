import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { BorrowLevelSchema } from '@chags/templates/schemas';
import type { BorrowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function borrowLevel(content: ContentEntry): BorrowLevel {
  return BorrowLevelSchema.parse(stageScript(content, 'borrow'));
}
