import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shengdong-jixi',
  title: '声东击西',
  version: '0.1.0',
  template: 'ruse',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
