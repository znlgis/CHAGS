import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yuanjiao-jingong',
  title: '远交近攻',
  version: '0.1.0',
  template: 'matchup',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 六个势力：看一圈，按顺序点六个，中间点错了重来（零惩罚）
  sessionSeconds: [40, 120],
  skills: ['先后顺序', '远交近攻', '看地图'],
  curriculum: { dynasty: '战国', yearApprox: -270, figures: ['范雎', '秦昭王'] },
  assets: { cover: 'none' },
};
