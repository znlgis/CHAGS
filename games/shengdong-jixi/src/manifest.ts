import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'shengdong-jixi',
  title: '声东击西',
  version: '0.1.0',
  template: 'ruse',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [90, 180],
  skills: ['看这边', '从那边走'],
  curriculum: { dynasty: '东汉', yearApprox: 87, figures: ['班超'] },
  assets: { cover: 'none' },
};
