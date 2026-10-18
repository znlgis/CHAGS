import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'weiwei-jiuzhao',
  title: '围魏救赵',
  version: '0.1.0',
  template: 'siege',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
};
