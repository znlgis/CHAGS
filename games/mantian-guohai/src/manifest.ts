import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'mantian-guohai',
  title: '瞒天过海',
  version: '0.1.0',
  template: 'ruse',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
