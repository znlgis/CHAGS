import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'lianhuan-ji',
  title: '连环计',
  version: '0.1.0',
  template: 'chain',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
