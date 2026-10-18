import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'caochong-elephant',
  title: '曹冲称象',
  version: '0.1.0',
  template: 'substitution',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
