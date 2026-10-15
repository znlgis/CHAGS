import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'kurou-ji',
  title: '苦肉计',
  version: '0.1.0',
  template: 'split',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [70, 160],
  skills: ['看得见的真心', '分份量', '替别人想'],
  curriculum: { dynasty: '东汉', yearApprox: 208, figures: ['黄盖', '周瑜'] },
  assets: { cover: 'none' },
};
