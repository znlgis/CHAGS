import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fudi-chouxin',
  title: '釜底抽薪',
  version: '0.1.0',
  template: 'siege',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['找到根本', '不跟火硬碰'],
  curriculum: { dynasty: '东汉', yearApprox: 200, figures: ['曹操', '袁绍'] },
  assets: { cover: 'none' },
};
