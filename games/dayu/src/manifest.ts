import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'dayu',
  title: '大禹治水',
  version: '0.1.0',
  template: 'trace',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
};
