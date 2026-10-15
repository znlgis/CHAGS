import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { BorrowBannerLevelSchema } from '@chags/templates/schemas';
import type { BorrowBannerLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function bannerLevel(content: ContentEntry): BorrowBannerLevel {
  return BorrowBannerLevelSchema.parse(stageScript(content, 'borrow'));
}
