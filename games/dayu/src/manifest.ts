import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'dayu',
  title: '大禹治水',
  version: '0.1.0',
  template: 'trace',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [120, 240],
  skills: ['引水', '想办法'],
  curriculum: { dynasty: '夏', yearApprox: -2070, figures: ['大禹', '鲧'] },
  assets: { cover: 'none' },
};
