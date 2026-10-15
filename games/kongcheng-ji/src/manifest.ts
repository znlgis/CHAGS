import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'kongcheng-ji',
  title: '空城计',
  version: '0.1.0',
  template: 'stillness',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 三轮盯着看一共 14 秒，忍住两轮他就退；中间多动几下只是白忍一轮，零惩罚
  sessionSeconds: [50, 130],
  skills: ['忍住不动', '看准他什么时候在看', '越是紧张越要稳'],
  curriculum: { dynasty: '三国', yearApprox: 219, figures: ['赵云', '曹操'] },
  assets: { cover: 'none' },
};
