import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'pangu',
  title: '盘古开天辟地',
  version: '0.1.0',
  template: 'grow',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [150, 300],
  skills: ['想象', '坚持', '联想'],
  curriculum: { dynasty: '上古', yearApprox: -9999, figures: ['盘古'] },
  assets: { cover: 'none' },
};
