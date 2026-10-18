import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'nuwa',
  title: '女娲补天',
  version: '0.1.0',
  template: 'place',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
