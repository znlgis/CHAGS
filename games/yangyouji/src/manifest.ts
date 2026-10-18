import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yangyouji',
  title: '百步穿杨',
  version: '0.1.0',
  template: 'aim',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
