import { stageScript } from '@chags/content/full';
import type { ContentEntry } from '@chags/content';
import { ProbeHintSchema } from '@chags/templates/schemas';
import type { ProbeHintLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function zhisangLevel(content: ContentEntry): ProbeHintLevel {
  return ProbeHintSchema.parse(stageScript(content, 'probe'));
}
