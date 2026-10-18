import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'hunshui-moyu',
  title: '混水摸鱼',
  version: '0.1.0',
  template: 'window',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 三条鱼：搅一下水能抓一小会儿，抓不完再搅 —— 开局几秒，慢手两分钟
};
