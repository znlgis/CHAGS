import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'qiren',
  title: '杞人忧天',
  version: '0.1.0',
  template: 'place',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['观察', '想明白'],
  curriculum: { dynasty: '战国', yearApprox: -350, figures: ['杞人'] },
  assets: { cover: 'none' },
};
