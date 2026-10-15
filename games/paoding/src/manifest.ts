import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'paoding',
  title: '庖丁解牛',
  version: '0.1.0',
  template: 'butcher',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['找规律', '顺着来'],
  curriculum: { dynasty: '战国', yearApprox: -300, figures: ['庖丁', '文惠君'] },
  assets: { cover: 'none' },
};
