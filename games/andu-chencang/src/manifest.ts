import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'andu-chencang',
  title: '暗度陈仓',
  version: '0.1.0',
  template: 'twoline',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['两条线', '撑着'],
  curriculum: { dynasty: '秦末', yearApprox: -206, figures: ['韩信', '刘邦'] },
  assets: { cover: 'none' },
};
