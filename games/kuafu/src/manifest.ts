import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'kuafu',
  title: '夸父追日',
  version: '0.1.0',
  template: 'tap',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [120, 240],
  skills: ['坚持', '勇气'],
  curriculum: { dynasty: '上古', yearApprox: -9994, figures: ['夸父'] },
  assets: { cover: 'none' },
};
