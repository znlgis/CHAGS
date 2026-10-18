import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'zhisang-mahuai',
  title: '指桑骂槐',
  version: '0.1.0',
  template: 'probe',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
