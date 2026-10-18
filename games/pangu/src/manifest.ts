import type { GameManifest } from '@chags/game-kit';
import { DESIGN } from '@chags/templates/layout';

export const manifest: GameManifest = {
  id: 'pangu',
  title: '盘古开天辟地',
  version: '0.1.0',
  // 撑天那一段是 tap（点满一万八千年），不是已经删掉的 grow 模板
  template: 'tap',
  designSize: { width: DESIGN.width, height: DESIGN.height },
  ageRange: [7, 10],
};
