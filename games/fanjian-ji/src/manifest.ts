import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fanjian-ji',
  title: '反间计',
  version: '0.1.0',
  template: 'twoline',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['趁空档按住', '让他自己看到', '被回头撞见就重来'],
  curriculum: { dynasty: '秦末', yearApprox: -204, figures: ['陈平', '项羽', '范增'] },
  assets: { cover: 'none' },
};
