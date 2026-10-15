import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import { BeaconLevelSchema } from '@chags/templates/schemas';
import type { BeaconLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function beaconLevel(content: ContentEntry): BeaconLevel {
  return BeaconLevelSchema.parse(stageScript(content, 'beacon'));
}
