import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'qinzei-qinwang',
  title: '擒贼擒王',
  version: '0.1.0',
  template: 'probe',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [9, 12],
  sessionSeconds: [60, 150],
  skills: ['找关键', '看反应'],
  curriculum: { dynasty: '唐', yearApprox: 757, figures: ['张巡', '尹子奇'] },
  assets: { cover: 'none' },
};
