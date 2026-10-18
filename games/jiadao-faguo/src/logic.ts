import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { ChainLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测（这一关只有 pass 那一半） */
export function jiadaoLevel(content: ContentEntry): ChainLevel {
  return asLevel<ChainLevel>(stageScript(content, 'chain'));
}
