import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'chenhuo-dajie',
  title: '趁火打劫',
  version: '0.1.0',
  template: 'window',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
  // 稳 4.2 秒、乱 3 秒，三件活儿各占一个窗口
  sessionSeconds: [70, 180],
  skills: ['时机', '窗口', '看准'],
  curriculum: { dynasty: '春秋', yearApprox: -482, figures: ['越王勾践', '吴王夫差'] },
  assets: { cover: 'none' },
};
