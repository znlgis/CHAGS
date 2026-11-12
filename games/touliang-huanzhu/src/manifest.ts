import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'touliang-huanzhu',
  title: '梁柱换新',
  version: '0.1.0',
  template: 'swap',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
