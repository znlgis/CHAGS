import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'caochong-elephant',
  title: '曹冲称象',
  version: '0.1.0',
  template: 'balance',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
  sessionSeconds: [120, 300],
  skills: ['观察', '等量代换', '浮力'],
  curriculum: { dynasty: '三国', yearApprox: 210, figures: ['曹冲', '曹操'] },
  assets: { cover: 'none' },
};
