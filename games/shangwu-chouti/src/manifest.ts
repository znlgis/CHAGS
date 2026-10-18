import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shangwu-chouti',
  title: '上屋抽梯',
  version: '0.1.0',
  template: 'siege',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
