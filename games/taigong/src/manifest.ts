import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'taigong',
  title: '太公钓鱼',
  version: '0.1.0',
  template: 'wait',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['等待', '专注'],
  curriculum: { dynasty: '商末周初', yearApprox: -1050, figures: ['姜子牙', '周文王'] },
  assets: { cover: 'none' },
};
