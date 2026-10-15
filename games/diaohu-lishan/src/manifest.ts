import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates';

export const manifest: GameManifest = {
  id: 'diaohu-lishan',
  title: '调虎离山',
  version: '0.1.0',
  template: 'lure',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [70, 160],
  skills: ['挑空档', '把他引开'],
  curriculum: { dynasty: '东汉末', yearApprox: 199, figures: ['孙策', '刘勋'] },
  assets: { cover: 'none' },
};
