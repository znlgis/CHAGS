import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'meiren-ji',
  title: '美人计',
  version: '0.1.0',
  template: 'lure',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['看他在看什么', '送对那一样', '送错不算输'],
  curriculum: { dynasty: '春秋', yearApprox: -490, figures: ['勾践', '夫差', '西施'] },
  assets: { cover: 'none' },
};
