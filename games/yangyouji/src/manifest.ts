import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'yangyouji',
  title: '百步穿杨',
  version: '0.1.0',
  template: 'aim',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['瞄准', '练习'],
  curriculum: { dynasty: '春秋', yearApprox: -575, figures: ['养由基'] },
  assets: { cover: 'none' },
};
