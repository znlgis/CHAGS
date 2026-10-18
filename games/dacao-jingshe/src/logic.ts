import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { ProbeKnockSchema } from '@chags/templates/schemas';
import type { ProbeLevel } from '@chags/templates/schemas';

/** 这一关只有 knock 那一半（联合类型里 Narrow 出来，画面上就不用再判一次） */
export type KnockLevel = Extract<ProbeLevel, { mode: 'knock' }>;

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function dacaoLevel(content: ContentEntry): KnockLevel {
  return ProbeKnockSchema.parse(stageScript(content, 'probe'));
}
