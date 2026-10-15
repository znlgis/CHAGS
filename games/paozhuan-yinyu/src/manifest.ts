import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'paozhuan-yinyu',
  title: '抛砖引玉',
  version: '0.1.0',
  template: 'lure',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [9, 12],
  sessionSeconds: [70, 160],
  skills: ['先给一点', '挑对那块砖'],
  curriculum: { dynasty: '唐', yearApprox: 800, figures: ['常建', '赵嘏'] },
  assets: { cover: 'none' },
};
