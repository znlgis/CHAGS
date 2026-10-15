import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jinchan-tuoqiao',
  title: '金蝉脱壳',
  version: '0.1.0',
  template: 'swap',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['照着原样换', '看准两次检查', '悄悄走'],
  curriculum: { dynasty: '南宋', yearApprox: 1206, figures: ['毕再遇'] },
  assets: { cover: 'none' },
};
