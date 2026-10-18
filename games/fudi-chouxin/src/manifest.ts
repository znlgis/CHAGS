import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fudi-chouxin',
  title: '釜底抽薪',
  version: '0.1.0',
  template: 'siege',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
