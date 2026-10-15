import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'wuzhong-shengyou',
  title: '无中生有',
  version: '0.1.0',
  template: 'show',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['从无到有', '撑住'],
  curriculum: { dynasty: '三国', yearApprox: 208, figures: ['诸葛亮', '鲁肃'] },
  assets: { cover: 'none' },
};
