import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { WaitLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测。wait 模板本身在模板那边有单测 */
export function waitLevel(content: ContentEntry): WaitLevel {
  return asLevel<WaitLevel>(stageScript(content, 'wait'));
}
