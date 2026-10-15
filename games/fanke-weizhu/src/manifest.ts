import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'fanke-weizhu',
  title: '反客为主',
  version: '0.1.0',
  template: 'chain',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [50, 130],
  skills: ['一步一步来', '先问过再动手', '把事接下来'],
  curriculum: { dynasty: '东汉', yearApprox: 211, figures: ['刘备', '刘璋', '法正'] },
  assets: { cover: 'none' },
};
