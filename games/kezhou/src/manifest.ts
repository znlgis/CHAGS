import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'kezhou',
  title: '刻舟求剑',
  version: '0.1.0',
  template: 'mark',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['观察', '应变'],
  curriculum: { dynasty: '战国', yearApprox: -239, figures: ['楚人'] },
  assets: { cover: 'none' },
};
