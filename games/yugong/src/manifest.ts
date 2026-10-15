import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'yugong',
  title: '愚公移山',
  version: '0.1.0',
  template: 'tap',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 11],
  sessionSeconds: [150, 300],
  skills: ['坚持', '传承', '面对质疑'],
  curriculum: { dynasty: '战国', yearApprox: -320, figures: ['愚公', '智叟'] },
  assets: { cover: 'none' },
};
