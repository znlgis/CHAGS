import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'weiwei-jiuzhao',
  title: '围魏救赵',
  version: '0.1.0',
  template: 'siege',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 11],
  sessionSeconds: [60, 150],
  skills: ['找要害', '换个地方使力'],
  curriculum: { dynasty: '战国', yearApprox: -354, figures: ['孙膑', '田忌', '庞涓'] },
  assets: { cover: 'none' },
};
