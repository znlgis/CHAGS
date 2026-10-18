import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { ChainStepSchema } from '@chags/templates/schemas';
import type { ChainStepLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测（第 30 计这一关只有 step 那一半） */
export function fankeLevel(content: ContentEntry): ChainStepLevel {
  return ChainStepSchema.parse(stageScript(content, 'chain'));
}
