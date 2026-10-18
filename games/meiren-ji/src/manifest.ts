import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'meiren-ji',
  title: '美人计',
  version: '0.1.0',
  template: 'lure',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
