import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'xiaoli-cangdao',
  title: '笑里藏刀',
  version: '0.1.0',
  template: 'read',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
