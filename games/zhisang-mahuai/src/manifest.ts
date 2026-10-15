import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'zhisang-mahuai',
  title: '指桑骂槐',
  version: '0.1.0',
  template: 'probe',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['换个说法', '不点名', '说给该听的人'],
  curriculum: { dynasty: '秦', yearApprox: -209, figures: ['优旃', '秦二世'] },
  assets: { cover: 'none' },
};
