import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jiachi-budian',
  title: '假痴不癫',
  version: '0.1.0',
  template: 'stillness',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
