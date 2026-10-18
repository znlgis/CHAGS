import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'andu-chencang',
  title: '暗度陈仓',
  version: '0.1.0',
  template: 'twoline',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
