import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { ChainLevelSchema } from '@chags/templates/schemas';
import type { ChainLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测（这一关只有 pass 那一半） */
export function jiadaoLevel(content: ContentEntry): ChainLevel {
  return ChainLevelSchema.parse(stageScript(content, 'chain'));
}
