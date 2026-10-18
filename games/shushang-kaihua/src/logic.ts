import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { ShowBorrowSchema } from '@chags/templates/schemas';
import type { ShowBorrowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测（第 29 计这一关只有 borrow 那一半） */
export function shushangLevel(content: ContentEntry): ShowBorrowLevel {
  return ShowBorrowSchema.parse(stageScript(content, 'show'));
}
