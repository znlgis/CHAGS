import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import type { ProbeLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 这一关只有 knock 那一半（联合类型里 Narrow 出来，画面上就不用再判一次） */
export type KnockLevel = Extract<ProbeLevel, { mode: 'knock' }>;

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function dacaoLevel(content: ContentEntry): KnockLevel {
  return asLevel<KnockLevel>(stageScript(content, 'probe'));
}
