import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shushang-kaihua',
  title: '树上开花',
  version: '0.1.0',
  template: 'show',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
