import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { AimLevelSchema } from '@chags/templates/schemas';
import type { AimLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function aimLevel(content: ContentEntry): AimLevel {
  return AimLevelSchema.parse(stageScript(content, 'aim'));
}

/** 当前这一档射的是哪一片叶子 */
export function rungTargetId(level: AimLevel, rungIndex: number): string | undefined {
  return level.ladder?.rungs[rungIndex]?.targetId;
}
