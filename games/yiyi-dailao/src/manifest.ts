import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yiyi-dailao',
  title: '以逸待劳',
  version: '0.1.0',
  template: 'stillness',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
  // 三通鼓一轮 12.6 秒，耐心等完再出手；失手只是重来一轮
};
