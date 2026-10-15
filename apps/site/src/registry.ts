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
  kezhou: () => import('@chags/game-kezhou'),
  zhaosanmusi: () => import('@chags/game-zhaosanmusi'),
  jiaotu: () => import('@chags/game-jiaotu'),
  yangyouji: () => import('@chags/game-yangyouji'),
  paoding: () => import('@chags/game-paoding'),
  // 三十六计 · 第一辑（胜战计 1–6）
  'mantian-guohai': () => import('@chags/game-mantian-guohai'),
  'weiwei-jiuzhao': () => import('@chags/game-weiwei-jiuzhao'),
  'jiedao-sharen': () => import('@chags/game-jiedao-sharen'),
  'yiyi-dailao': () => import('@chags/game-yiyi-dailao'),
  'chenhuo-dajie': () => import('@chags/game-chenhuo-dajie'),
  'shengdong-jixi': () => import('@chags/game-shengdong-jixi'),
  // 三十六计 · 第二辑（敌战计 7–12）
  'wuzhong-shengyou': () => import('@chags/game-wuzhong-shengyou'),
  'andu-chencang': () => import('@chags/game-andu-chencang'),
  'gean-guanhuo': () => import('@chags/game-gean-guanhuo'),
  'xiaoli-cangdao': () => import('@chags/game-xiaoli-cangdao'),
  'lidai-taojiang': () => import('@chags/game-lidai-taojiang'),
  'shunshou-qianyang': () => import('@chags/game-shunshou-qianyang'),
};
