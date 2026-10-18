import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'paozhuan-yinyu',
  title: '抛砖引玉',
  version: '0.1.0',
  template: 'lure',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [9, 12],
};
