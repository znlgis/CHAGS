import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'zou-weishang',
  title: '走为上',
  version: '0.1.0',
  template: 'trace',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [80, 180],
  skills: ['该退就退', '保住人和东西', '看准退路'],
  curriculum: { dynasty: '春秋', yearApprox: -632, figures: ['晋文公', '子犯'] },
  assets: { cover: 'none' },
};
