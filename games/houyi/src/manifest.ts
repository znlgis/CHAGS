import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'houyi',
  title: '后羿射日',
  version: '0.1.0',
  template: 'aim',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [150, 300],
  skills: ['瞄准', '判断', '分寸'],
  curriculum: { dynasty: '上古', yearApprox: -9997, figures: ['后羿', '尧'] },
  assets: { cover: 'none' },
};
