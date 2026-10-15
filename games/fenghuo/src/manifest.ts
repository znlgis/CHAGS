import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fenghuo',
  title: '烽火戏诸侯',
  version: '0.1.0',
  template: 'beacon',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
  sessionSeconds: [120, 240],
  skills: ['因果', '信用'],
  curriculum: { dynasty: '西周', yearApprox: -771, figures: ['周幽王', '褒姒'] },
  assets: { cover: 'none' },
};
