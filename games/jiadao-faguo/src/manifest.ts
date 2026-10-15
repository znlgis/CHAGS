import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jiadao-faguo',
  title: '假道伐虢',
  version: '0.1.0',
  template: 'chain',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [45, 120],
  skills: ['谈成借路', '按顺序过关口', '先想后果'],
  curriculum: { dynasty: '春秋', yearApprox: -655, figures: ['晋献公', '虞公', '宫之奇'] },
  assets: { cover: 'none' },
};
