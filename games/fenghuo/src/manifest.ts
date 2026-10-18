import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fenghuo',
  title: '烽火戏诸侯',
  version: '0.1.0',
  template: 'beacon',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
};
