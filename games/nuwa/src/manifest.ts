import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'nuwa',
  title: '女娲补天',
  version: '0.1.0',
  template: 'place',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [120, 240],
  skills: ['观察', '配对', '修补'],
  curriculum: { dynasty: '上古', yearApprox: -9996, figures: ['女娲'] },
  assets: { cover: 'none' },
};
