import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'gean-guanhuo',
  title: '隔岸观火',
  version: '0.1.0',
  template: 'wait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 等 45 秒；点了"过河劝架"会往后推 6 秒（最多三次），所以一局可能到两分钟
};
