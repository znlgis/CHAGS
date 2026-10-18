import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jieshi-huanhun',
  title: '借尸还魂',
  version: '0.1.0',
  template: 'borrow',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
};
