import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'qinzei-qinwang',
  title: '擒贼擒王',
  version: '0.1.0',
  template: 'probe',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [9, 12],
};
