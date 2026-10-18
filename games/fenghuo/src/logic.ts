import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import type { BeaconLevel } from '@chags/templates/schemas';
import { asLevel } from '@chags/game-kit';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function beaconLevel(content: ContentEntry): BeaconLevel {
  return asLevel<BeaconLevel>(stageScript(content, 'beacon'));
}
