import type { GameModule } from '@chags/game-kit';

/**
 * 新增一个典故 = 加一行 import。外壳不认识任何具体玩法，
 * Vite 会自动把每个游戏切成独立 chunk（Phaser 只在这些 chunk 里）。
 */
export const registry: Record<string, () => Promise<{ default: GameModule }>> = {
  'caochong-elephant': () => import('@chags/game-caochong-elephant'),
  pangu: () => import('@chags/game-pangu'),
  houyi: () => import('@chags/game-houyi'),
  nuwa: () => import('@chags/game-nuwa'),
  jingwei: () => import('@chags/game-jingwei'),
  kuafu: () => import('@chags/game-kuafu'),
  yugong: () => import('@chags/game-yugong'),
  shennong: () => import('@chags/game-shennong'),
  qiren: () => import('@chags/game-qiren'),
  fenghuo: () => import('@chags/game-fenghuo'),
  taigong: () => import('@chags/game-taigong'),
  dayu: () => import('@chags/game-dayu'),
};
