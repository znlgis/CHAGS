import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'lianhuan-ji',
  title: '连环计',
  version: '0.1.0',
  template: 'chain',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [40, 110],
  skills: ['一环接一环', '按顺序点亮', '断了就重来'],
  curriculum: { dynasty: '东汉', yearApprox: 208, figures: ['曹操', '周瑜', '庞统'] },
  assets: { cover: 'none' },
};
