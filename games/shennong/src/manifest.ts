import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'shennong',
  title: '神农尝百草',
  version: '0.1.0',
  template: 'sort',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [90, 180],
  skills: ['观察', '记录'],
  curriculum: { dynasty: '上古', yearApprox: -2800, figures: ['神农', '炎帝'] },
  assets: { cover: 'none' },
};
