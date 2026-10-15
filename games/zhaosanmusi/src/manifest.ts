import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'zhaosanmusi',
  title: '朝三暮四',
  version: '0.1.0',
  template: 'split',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['数数', '看穿说法'],
  curriculum: { dynasty: '战国', yearApprox: -300, figures: ['狙公'] },
  assets: { cover: 'none' },
};
