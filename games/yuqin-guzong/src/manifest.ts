import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'yuqin-guzong',
  title: '欲擒故纵',
  version: '0.1.0',
  template: 'chase',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [9, 12],
  sessionSeconds: [60, 150],
  skills: ['保持距离', '耐心', '让他心服'],
  curriculum: { dynasty: '三国', yearApprox: 225, figures: ['诸葛亮', '孟获'] },
  assets: { cover: 'none' },
};
