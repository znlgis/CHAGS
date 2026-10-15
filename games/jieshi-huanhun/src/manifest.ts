import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'jieshi-huanhun',
  title: '借尸还魂',
  version: '0.1.0',
  template: 'borrow',
  orientation: 'portrait',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [8, 12],
  sessionSeconds: [60, 150],
  skills: ['名号', '聚人', '旧旗'],
  curriculum: { dynasty: '秦末', yearApprox: -209, figures: ['陈胜', '吴广'] },
  assets: { cover: 'none' },
};
