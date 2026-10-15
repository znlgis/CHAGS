import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jiedao-sharen',
  title: '借刀杀人',
  version: '0.1.0',
  template: 'borrow',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['借力', '杠杆', '请人帮忙'],
  curriculum: { dynasty: '春秋', yearApprox: -484, figures: ['子贡', '孔子'] },
  assets: { cover: 'none' },
};
