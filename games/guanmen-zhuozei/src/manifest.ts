import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'guanmen-zhuozei',
  title: '关门捉贼',
  version: '0.1.0',
  template: 'siege',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
