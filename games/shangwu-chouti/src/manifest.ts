import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shangwu-chouti',
  title: '上屋抽梯',
  version: '0.1.0',
  template: 'siege',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['先给方便', '等他到位'],
  curriculum: { dynasty: '西汉', yearApprox: -204, figures: ['韩信', '陈馀'] },
  assets: { cover: 'none' },
};
