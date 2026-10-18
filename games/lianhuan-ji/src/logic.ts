import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { ChainDominoSchema } from '@chags/templates/schemas';
import type { ChainDominoLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测（第 35 计这一关只有 domino 那一半） */
export function lianhuanLevel(content: ContentEntry): ChainDominoLevel {
  return ChainDominoSchema.parse(stageScript(content, 'chain'));
}
