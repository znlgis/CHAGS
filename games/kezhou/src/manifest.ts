import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'kezhou',
  title: '刻舟求剑',
  version: '0.1.0',
  template: 'mark',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
