import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'mantian-guohai',
  title: '瞒天过海',
  version: '0.1.0',
  template: 'ruse',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['平常的样子', '藏'],
  curriculum: { dynasty: '唐', yearApprox: 645, figures: ['薛仁贵', '唐太宗'] },
  assets: { cover: 'none' },
};
