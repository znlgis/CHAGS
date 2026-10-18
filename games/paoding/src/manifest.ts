import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'paoding',
  title: '庖丁解牛',
  version: '0.1.0',
  template: 'butcher',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
