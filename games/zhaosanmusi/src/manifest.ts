import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'zhaosanmusi',
  title: '朝三暮四',
  version: '0.1.0',
  template: 'split',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
