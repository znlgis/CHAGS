import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'taigong',
  title: '太公钓鱼',
  version: '0.1.0',
  template: 'wait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
};
