import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jingwei',
  title: '精卫填海',
  version: '0.1.0',
  template: 'tap',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
