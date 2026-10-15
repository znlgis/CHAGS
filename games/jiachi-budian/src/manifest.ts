import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jiachi-budian',
  title: '假痴不癫',
  version: '0.1.0',
  template: 'stillness',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [45, 120],
  skills: ['忍住不出声', '等对时机'],
  curriculum: { dynasty: '战国', yearApprox: -355, figures: ['孙膑', '庞涓'] },
  assets: { cover: 'none' },
};
