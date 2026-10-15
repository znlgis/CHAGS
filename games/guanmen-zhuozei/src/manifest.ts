import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'guanmen-zhuozei',
  title: '关门捉贼',
  version: '0.1.0',
  template: 'siege',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['先想退路', '把口子堵上'],
  curriculum: { dynasty: '战国', yearApprox: -341, figures: ['孙膑', '庞涓'] },
  assets: { cover: 'none' },
};
