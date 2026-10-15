import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'lidai-taojiang',
  title: '李代桃僵',
  version: '0.1.0',
  template: 'matchup',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['配对', '舍一局赢整场'],
  curriculum: { dynasty: '战国', yearApprox: -340, figures: ['孙膑', '田忌'] },
  assets: { cover: 'none' },
};
