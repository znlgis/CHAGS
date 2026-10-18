import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shennong',
  title: '神农尝百草',
  version: '0.1.0',
  template: 'sort',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
