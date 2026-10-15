import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'dacao-jingshe',
  title: '打草惊蛇',
  version: '0.1.0',
  template: 'probe',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['先试一试', '看反应'],
  curriculum: { dynasty: '五代', yearApprox: 940, figures: ['王鲁'] },
  assets: { cover: 'none' },
};
