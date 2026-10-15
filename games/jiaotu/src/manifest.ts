import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jiaotu',
  title: '狡兔三窟',
  version: '0.1.0',
  template: 'burrow',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['准备', '留后路'],
  curriculum: { dynasty: '战国', yearApprox: -298, figures: ['冯谖', '孟尝君'] },
  assets: { cover: 'none' },
};
