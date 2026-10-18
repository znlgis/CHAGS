import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'zou-weishang',
  title: '走为上',
  version: '0.1.0',
  template: 'trace',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
