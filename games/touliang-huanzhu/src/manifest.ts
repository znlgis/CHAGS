import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'touliang-huanzhu',
  title: '偷梁换柱',
  version: '0.1.0',
  template: 'swap',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [55, 140],
  skills: ['按住才换得完', '看准两次清点', '换掉关键的那一根'],
  curriculum: { dynasty: '秦', yearApprox: -207, figures: ['赵高', '秦二世'] },
  assets: { cover: 'none' },
};
