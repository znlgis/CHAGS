import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yuqin-guzong',
  title: '欲擒故纵',
  version: '0.1.0',
  template: 'chase',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
