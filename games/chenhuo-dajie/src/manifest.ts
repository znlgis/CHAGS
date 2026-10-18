import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'chenhuo-dajie',
  title: '趁火打劫',
  version: '0.1.0',
  template: 'window',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
  // 稳 4.2 秒、乱 3 秒，三件活儿各占一个窗口
};
