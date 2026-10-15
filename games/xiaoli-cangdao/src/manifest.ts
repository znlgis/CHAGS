import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'xiaoli-cangdao',
  title: '笑里藏刀',
  version: '0.1.0',
  template: 'read',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [70, 160],
  skills: ['看小动作', '别只听好话'],
  curriculum: { dynasty: '唐', yearApprox: 655, figures: ['李义府'] },
  assets: { cover: 'none' },
};
