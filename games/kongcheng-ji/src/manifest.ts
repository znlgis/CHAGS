import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'kongcheng-ji',
  title: '空城计',
  version: '0.1.0',
  template: 'stillness',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 三轮盯着看一共 14 秒，忍住两轮他就退；中间多动几下只是白忍一轮，零惩罚
};
