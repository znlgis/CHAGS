import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'shushang-kaihua',
  title: '树上开花',
  version: '0.1.0',
  template: 'show',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [45, 120],
  skills: ['借身边的势', '把旗放到最显眼的地方', '不慌'],
  curriculum: { dynasty: '东汉', yearApprox: 208, figures: ['张飞', '曹操'] },
  assets: { cover: 'none' },
};
