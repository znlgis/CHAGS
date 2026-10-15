import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jingwei',
  title: '精卫填海',
  version: '0.1.0',
  template: 'tap',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [120, 240],
  skills: ['坚持', '耐心'],
  curriculum: { dynasty: '上古', yearApprox: -9995, figures: ['精卫', '女娃'] },
  assets: { cover: 'none' },
};
