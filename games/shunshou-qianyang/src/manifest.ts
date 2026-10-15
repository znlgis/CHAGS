import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'shunshou-qianyang',
  title: '顺手牵羊',
  version: '0.1.0',
  template: 'window',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  // 一趟 45 秒；没抓够就重走一遍，所以一局可能走两三趟
  sessionSeconds: [70, 200],
  skills: ['顺手', '小机会', '别误正事'],
  curriculum: { dynasty: '唐', yearApprox: 817, figures: ['李愬'] },
  assets: { cover: 'none' },
};
