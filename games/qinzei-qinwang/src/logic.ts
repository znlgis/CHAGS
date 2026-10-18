import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { ProbeLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 这一关只有 spot 那一半（联合类型里 Narrow 出来，画面上就不用再判一次） */
export type SpotLevel = Extract<ProbeLevel, { mode: 'spot' }>;

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function qinzeiLevel(content: ContentEntry): SpotLevel {
  return asLevel<SpotLevel>(stageScript(content, 'probe'));
}
