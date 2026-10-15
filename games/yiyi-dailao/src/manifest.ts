import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yiyi-dailao',
  title: '以逸待劳',
  version: '0.1.0',
  template: 'stillness',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
  // 三通鼓一轮 12.6 秒，耐心等完再出手；失手只是重来一轮
  sessionSeconds: [60, 150],
  skills: ['等', '时机', '沉住气'],
  curriculum: { dynasty: '春秋', yearApprox: -684, figures: ['曹刿', '鲁庄公'] },
  assets: { cover: 'none' },
};
