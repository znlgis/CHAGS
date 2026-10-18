import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yugong',
  title: '愚公移山',
  version: '0.1.0',
  template: 'tap',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
};
